import { Node, ObjectLiteralExpression, SyntaxKind, ts } from 'ts-morph';
import {
  type ImplDef,
  type Implementations,
  access,
  getKeyText,
  isFunctionLike,
  nonModuleReferences,
  outerReferences,
  Skip,
  resolveConstAction,
  resolveIdentifier,
  resolveStringConstant,
  skip,
  unwrap,
  xstateCallee
} from './analysis.ts';

/** Replaced by the local name of `matchesState` once the import is ensured. */
export const MATCHES_STATE = '__xstate_codemod_matchesState__';

/** What v5's `enqueueActions` callback may destructure. */
const ENQUEUE_ARGS = new Set([
  'enqueue',
  'check',
  'context',
  'event',
  'self',
  'system'
]);
const ENQUEUE_METHODS = new Set([
  'assign',
  'raise',
  'sendTo',
  'sendParent',
  'emit',
  'log',
  'cancel',
  'stopChild',
  'spawnChild'
]);

/** Indentation of the line a node starts on. */
function indentOf(node: Node): string {
  const text = node.getSourceFile().getFullText();
  const lineStart = text.lastIndexOf('\n', node.getStart() - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))![0];
}

/** The symbol a (possibly shorthand-property) identifier refers to. */
function valueSymbol(id: Node) {
  const parent = id.getParent();
  if (Node.isShorthandPropertyAssignment(parent)) {
    return id
      .getProject()
      .getTypeChecker()
      .compilerObject.getShorthandAssignmentValueSymbol(parent.compilerNode);
  }
  return id.getSymbol()?.compilerSymbol;
}

/** `node`'s text with non-overlapping descendant ranges replaced. */
function spliceText(
  node: Node,
  replacements: Array<{ node: Node; text: string }>
): string {
  const start = node.getStart();
  let text = node.getText();
  const inside = replacements
    .filter(
      (r) => r.node.getStart() >= start && r.node.getEnd() <= node.getEnd()
    )
    .sort((a, b) => b.node.getStart() - a.node.getStart());
  for (const r of inside) {
    text =
      text.slice(0, r.node.getStart() - start) +
      r.text +
      text.slice(r.node.getEnd() - start);
  }
  return text;
}

/** Names v5 passed to actions and guards that the v6 `args` object also has. */
const HOISTABLE = new Set(['context', 'event', 'self', 'system']);
const RESERVED = new Set(['args', 'enq', 'context', 'patch']);

const TRANSITION_KEYS = new Set([
  'target',
  'actions',
  'guard',
  'reenter',
  'description',
  'meta'
]);

export interface FileContext {
  xs: Map<string, string>;
  impls: Implementations;
  /** Named `assign` definitions whose call sites were rewritten. */
  assignDefs: Set<ImplDef>;
  /** Module-level action consts that must not be lowered (some use is not). */
  disabledConsts: Set<Node>;
}

interface Inline {
  names: string[];
  body: Node;
}

/** `({ a, b }) => expr` (or `() => expr`) whose body can be substituted in place. */
function inlineable(fn: Node): Inline | undefined {
  if (!Node.isArrowFunction(fn) || fn.isAsync()) return undefined;
  const body = fn.getBody();
  if (Node.isBlock(body)) return undefined;
  const params = fn.getParameters();
  if (params.length === 0) return { names: [], body };
  if (params.length !== 1) return undefined;
  const param = params[0];
  if (param.getInitializer() || param.isRestParameter()) return undefined;
  const pattern = param.getNameNode();
  if (!Node.isObjectBindingPattern(pattern)) return undefined;
  const names: string[] = [];
  for (const element of pattern.getElements()) {
    const name = element.getNameNode();
    if (
      element.getPropertyNameNode() ||
      element.getInitializer() ||
      element.getDotDotDotToken() ||
      !Node.isIdentifier(name) ||
      !HOISTABLE.has(name.getText())
    )
      return undefined;
    names.push(name.getText());
  }
  return { names, body };
}

function isAtomic(node: Node): boolean {
  return (
    Node.isIdentifier(node) ||
    Node.isPropertyAccessExpression(node) ||
    Node.isElementAccessExpression(node) ||
    Node.isCallExpression(node) ||
    Node.isParenthesizedExpression(node) ||
    Node.isStringLiteral(node) ||
    Node.isNumericLiteral(node) ||
    Node.isNoSubstitutionTemplateLiteral(node) ||
    Node.isTrueLiteral(node) ||
    Node.isFalseLiteral(node) ||
    Node.isPrefixUnaryExpression(node)
  );
}

const paren = (node: Node) =>
  isAtomic(node) ? node.getText() : `(${node.getText()})`;

/** A context patch: object-literal properties, or an expression evaluating to one. */
type Patch = { props: string } | { expr: string };

class Branch {
  entries: Array<string | Patch> = [];
  assigned = false;
  enqueued = false;
  /** Patches written from nested control flow: always accumulate in `patch`. */
  forcePatch = false;
  /** Arguments text for guards evaluated against an earlier context. */
  argsOverride: string | undefined;
  argsObj() {
    if (this.argsOverride) return this.argsOverride;
    return this.assigned ? '{ ...args, context }' : 'args';
  }
  push(line: string, enqueues = true) {
    this.entries.push(line);
    if (enqueues) this.enqueued = true;
  }
  pushPatch(patch: Patch) {
    this.entries.push(patch);
    this.assigned = true;
  }
  /**
   * Statement lines plus the `context` return field. Only the patch is
   * returned, never the whole threaded context: v6 evaluates the transitions
   * of parallel regions against the same context and merges their patches,
   * so returning every key would undo a sibling region's update.
   */
  finish(fb: FunctionBuilder): { lines: string[]; context?: string } {
    const patches = this.entries.filter((e) => typeof e !== 'string');
    const last = this.entries[this.entries.length - 1];
    if (patches.length === 1 && typeof last !== 'string' && !this.forcePatch) {
      const lines = this.entries.slice(0, -1) as string[];
      return {
        lines,
        context:
          'props' in last
            ? `context: { ${last.props} }`
            : `context: ${last.expr}`
      };
    }
    if (!patches.length && !this.forcePatch) {
      return { lines: this.entries as string[] };
    }
    fb.threaded = true;
    return { lines: threadedLines(this.entries), context: 'context: patch' };
  }
}

function threadedLines(entries: Array<string | Patch>): string[] {
  return entries.flatMap((e) =>
    typeof e === 'string'
      ? [e]
      : [
          'props' in e
            ? `patch = { ...patch, ${e.props} };`
            : `patch = { ...patch, ...${e.expr} };`,
          'context = { ...args.context, ...patch };'
        ]
  );
}

/** Builds one generated `(args, enq) => { ... }` function. */
export class FunctionBuilder {
  hoist = new Set<string>();
  /** Named definitions inlined into this function. */
  inlinedDefs = new Set<ImplDef>();
  /** Module-level action consts called here, with the referencing identifiers. */
  constRefs = new Map<Node, Node[]>();
  /** True when some branch keeps a running `context` and `patch`. */
  threaded = false;
  inline: boolean;
  /** `params` of the named action being inlined, passed to its dynamic values. */
  private paramsText: string | undefined;
  private ctx: FileContext;

  constructor(ctx: FileContext, node: Node) {
    this.ctx = ctx;
    const reserved = outerReferences(node, RESERVED);
    if (reserved.size) {
      skip(
        `references outer '${[...reserved].join("', '")}', which the generated function would shadow`
      );
    }
    this.inline =
      outerReferences(node, new Set(['event', 'self', 'system'])).size === 0;
  }

  private inlined(fn: Node): Inline | undefined {
    if (!this.inline) return undefined;
    const result = inlineable(fn);
    if (result) result.names.forEach((name) => this.hoist.add(name));
    return result;
  }

  /** A value v5 accepted either directly or as a function of the action args. */
  dynamic(node: Node, br: Branch, argsText = br.argsObj()): string {
    const value = unwrap(node);
    if (isFunctionLike(value)) {
      const inline = this.inlined(value);
      const p = this.paramsText ? `, ${this.paramsText}` : '';
      if (inline) return inline.body.getText();
      return `(${value.getText()})(${argsText}${p})`;
    }
    if (Node.isIdentifier(value)) {
      if (value.getText() === 'undefined') return 'undefined';
      const kind = resolveIdentifier(value);
      const p = this.paramsText ? `, ${this.paramsText}` : '';
      if (kind === 'fn') return `${value.getText()}(${argsText}${p})`;
      if (kind === 'value') return node.getText();
      return skip(`cannot tell whether '${value.getText()}' is a function`);
    }
    if (Node.isCallExpression(value) || Node.isNewExpression(value)) {
      return skip(`'${value.getText()}' may evaluate to a function`);
    }
    return node.getText();
  }

  private options(node: Node | undefined, br: Branch, keys: string[]): string {
    if (!node) return '';
    const value = unwrap(node);
    if (!Node.isObjectLiteralExpression(value)) {
      return skip('options are not an object literal');
    }
    const parts = value.getProperties().map((property) => {
      const key = getKeyText(property);
      if (!key || !keys.includes(key) || !Node.isPropertyAssignment(property)) {
        return skip(`unsupported option '${property.getText()}'`);
      }
      return `${key}: ${this.dynamic(property.getInitializer()!, br)}`;
    });
    return parts.length ? `, { ${parts.join(', ')} }` : '';
  }

  // ---- guards ---------------------------------------------------------------

  guard(node: Node, br: Branch): { text: string; atomic: boolean } {
    const value = unwrap(node);
    const ref = Node.isIdentifier(value) ? undefined : nameRef(value);
    if (ref) return this.namedGuard(ref, undefined, br);
    if (Node.isObjectLiteralExpression(value)) {
      const { ref, params } = typeAndParams(value, 'guard');
      return this.namedGuard(ref, params, br);
    }
    if (isFunctionLike(value)) {
      const inline = this.inlined(value);
      if (inline) {
        return { text: inline.body.getText(), atomic: isAtomic(inline.body) };
      }
      return { text: `(${value.getText()})(${br.argsObj()})`, atomic: true };
    }
    if (Node.isIdentifier(value)) {
      if (resolveIdentifier(value) === 'fn') {
        return { text: `${value.getText()}(${br.argsObj()})`, atomic: true };
      }
      const named = resolveStringConstant(value);
      if (named !== undefined) {
        return this.namedGuard(
          { name: named, access: access(named) },
          undefined,
          br
        );
      }
      return skip(`unresolved guard '${value.getText()}'`);
    }
    const callee = xstateCallee(value, this.ctx.xs);
    if (callee && Node.isCallExpression(value)) {
      const [arg, ...rest] = value.getArguments();
      if (!arg || rest.length) return skip(`unsupported ${callee}(...) call`);
      switch (callee) {
        case 'and':
        case 'or': {
          const list = unwrap(arg);
          if (!Node.isArrayLiteralExpression(list)) {
            return skip(`${callee}(...) argument is not an array literal`);
          }
          const guards = list
            .getElements()
            .map((element) => this.guard(element, br));
          if (!guards.length) {
            return { text: callee === 'and' ? 'true' : 'false', atomic: true };
          }
          if (guards.length === 1) return guards[0];
          return {
            text: guards
              .map((g) => (g.atomic ? g.text : `(${g.text})`))
              .join(callee === 'and' ? ' && ' : ' || '),
            atomic: false
          };
        }
        case 'not': {
          const inner = this.guard(arg, br);
          return {
            text: `!${inner.atomic ? inner.text : `(${inner.text})`}`,
            atomic: true
          };
        }
        case 'stateIn': {
          const state = unwrap(arg);
          if (
            !(
              (Node.isStringLiteral(state) &&
                !state.getLiteralText().startsWith('#')) ||
              Node.isObjectLiteralExpression(state)
            )
          ) {
            return skip('stateIn(...) argument is not a state value literal');
          }
          return {
            text: `${MATCHES_STATE}(${state.getText()}, args.value)`,
            atomic: true
          };
        }
      }
    }
    return skip(`unsupported guard '${value.getText()}'`);
  }

  /** Throws unless a named definition can be inlined at a call site. */
  private inlineCheck(def: ImplDef, name: string) {
    const expr = def.expr!;
    const local = nonModuleReferences(expr);
    if (local.length) {
      skip(
        `'${name}' references '${local.join("', '")}', which are not module-scope`
      );
    }
    const shadowed = outerReferences(
      expr,
      new Set([...RESERVED, ...HOISTABLE, 'params'])
    );
    if (shadowed.size) {
      skip(
        `'${name}' references outer '${[...shadowed].join("', '")}', which the generated function would shadow`
      );
    }
  }

  private namedGuard(ref: NameRef, params: Node | undefined, br: Branch) {
    const { name } = ref;
    const def = this.ctx.impls.guards.get(name);
    if (def?.kind === 'inline') {
      if (params) return skip(`guard '${name}' is a combinator given params`);
      this.inlineCheck(def, name);
      this.inlinedDefs.add(def);
      return this.guard(def.expr!, br);
    }
    if (!def || def.kind !== 'fn') {
      return skip(`guard '${name}' is not a function defined in this file`);
    }
    const p = params ? `, ${this.dynamic(params, br)}` : '';
    return {
      text: `args.guards${ref.access}(${br.argsObj()}${p})`,
      atomic: true
    };
  }

  // ---- actions --------------------------------------------------------------

  /** True when the item writes context (an `assign`, inline or named). */
  isAssign(node: Node): boolean {
    const value = unwrap(node);
    if (xstateCallee(value, this.ctx.xs) === 'assign') return true;
    if (Node.isIdentifier(value)) {
      const constAction = resolveConstAction(value, this.ctx.xs);
      if (constAction?.callee === 'assign') {
        return !this.ctx.disabledConsts.has(constAction.decl);
      }
    }
    const name = Node.isObjectLiteralExpression(value)
      ? nameRef(getInit(value, 'type'))?.name
      : Node.isIdentifier(value)
        ? undefined
        : nameRef(value)?.name;
    return !!name && this.ctx.impls.actions.get(name)?.kind === 'assign';
  }

  actions(node: Node | undefined, br: Branch) {
    if (!node) return;
    const value = unwrap(node);
    const items = Node.isArrayLiteralExpression(value)
      ? value.getElements()
      : [value];
    let lastAssign = -1;
    items.forEach((item, i) => {
      if (this.isAssign(item)) lastAssign = i;
    });
    items.forEach((item, i) => {
      for (const comment of leadingComments(item)) br.push(comment, false);
      this.action(item, br, i > lastAssign);
    });
  }

  private action(node: Node, br: Branch, contextIsFinal: boolean) {
    const value = unwrap(node);
    const ref = Node.isIdentifier(value) ? undefined : nameRef(value);
    if (ref) return this.namedAction(ref, undefined, br);
    if (Node.isObjectLiteralExpression(value)) {
      const { ref, params } = typeAndParams(value, 'action');
      return this.namedAction(ref, params, br);
    }
    if (Node.isIdentifier(value)) {
      const named = resolveStringConstant(value);
      if (named !== undefined) {
        return this.namedAction(
          { name: named, access: access(named) },
          undefined,
          br
        );
      }
      const constAction = resolveConstAction(value, this.ctx.xs);
      if (constAction && !this.ctx.disabledConsts.has(constAction.decl)) {
        const refs = this.constRefs.get(constAction.decl) ?? [];
        refs.push(value);
        this.constRefs.set(constAction.decl, refs);
        if (constAction.callee === 'assign') {
          const argsText = mentionsSpawn(constAction.call)
            ? spawnArgs(br)
            : br.argsObj();
          return br.pushPatch({ expr: `${value.getText()}(${argsText})` });
        }
        return br.push(`${value.getText()}(${br.argsObj()}, enq);`);
      }
      if (resolveIdentifier(value) !== 'fn') {
        return skip(`unresolved action '${value.getText()}'`);
      }
      return br.push(`enq(${value.getText()}, ${br.argsObj()});`);
    }
    if (isFunctionLike(value)) {
      const candidate = inlineable(value);
      if (
        candidate &&
        (contextIsFinal || !candidate.names.includes('context'))
      ) {
        const inline = this.inlined(value);
        if (inline) return br.push(`enq(() => ${inline.body.getText()});`);
      }
      return br.push(`enq(${value.getText()}, ${br.argsObj()});`);
    }
    const callee = xstateCallee(value, this.ctx.xs);
    if (!callee || !Node.isCallExpression(value)) {
      return skip(`unsupported action '${value.getText()}'`);
    }
    return this.creator(callee, value.getArguments(), br);
  }

  /** Rule C for `callee(...args)`, an action creator call. */
  private creator(callee: string, args: Node[], br: Branch): void {
    const arity = (min: number, max: number) => {
      if (args.length < min || args.length > max) {
        skip(`unsupported ${callee}(...) arity`);
      }
    };
    switch (callee) {
      case 'assign':
        arity(1, 1);
        return this.assign(args[0], br);
      case 'raise':
        arity(1, 2);
        return br.push(
          `enq.raise(${this.dynamic(args[0], br)}${this.options(args[1], br, ['delay', 'id'])});`
        );
      case 'sendTo':
        arity(2, 3);
        return br.push(
          `enq.sendTo(${this.target(args[0], br)}, ${this.dynamic(args[1], br)}${this.options(args[2], br, ['delay', 'id'])});`
        );
      case 'sendParent':
        arity(1, 2);
        return br.push(
          `enq.sendTo(args.parent, ${this.dynamic(args[0], br)}${this.options(args[1], br, ['delay', 'id'])});`
        );
      case 'forwardTo':
        arity(1, 2);
        return br.push(
          `enq.sendTo(${this.target(args[0], br)}, args.event${this.options(args[1], br, ['delay', 'id'])});`
        );
      case 'emit':
        arity(1, 1);
        return br.push(`enq.emit(${this.dynamic(args[0], br)});`);
      case 'log': {
        arity(0, 2);
        const logged = args[0]
          ? this.dynamic(args[0], br)
          : `{ context: ${br.assigned ? 'context' : 'args.context'}, event: args.event }`;
        const label = args[1];
        if (label && !Node.isStringLiteral(unwrap(label))) {
          return skip('log label is not a string literal');
        }
        return br.push(
          label
            ? `enq.log(${label.getText()}, ${logged});`
            : `enq.log(${logged});`
        );
      }
      case 'cancel':
        arity(1, 1);
        return br.push(`enq.cancel(${this.dynamic(args[0], br)});`);
      case 'stop':
      case 'stopChild': {
        arity(1, 1);
        const target = unwrap(args[0]);
        return br.push(
          Node.isStringLiteral(target)
            ? `enq.stop(args.children[${target.getText()}]);`
            : `enq.stop(${this.dynamic(args[0], br)});`
        );
      }
      case 'spawnChild': {
        arity(1, 2);
        const src = unwrap(args[0]);
        if (!Node.isStringLiteral(src) && !Node.isIdentifier(src)) {
          return skip('spawnChild source is not a name or identifier');
        }
        return br.push(
          `enq.spawn(${args[0].getText()}${this.options(args[1], br, ['id', 'input'])});`
        );
      }
      case 'enqueueActions':
        arity(1, 1);
        return this.enqueueActions(args[0], br);
    }
    return skip(`'${callee}(...)' cannot be lowered`);
  }

  /**
   * `enqueueActions(({ enqueue, check, ... }, params) => BODY)`: BODY is kept
   * with every `enqueue...(...)` call replaced by its rule-C statements and
   * every `check(g)` by its rule-B expression. v5's `context` and `check` see
   * the context from before the callback, even after `enqueue.assign`.
   */
  private enqueueActions(node: Node, br: Branch): void {
    const fn = unwrap(node);
    if (!Node.isArrowFunction(fn) && !Node.isFunctionExpression(fn)) {
      return skip('enqueueActions argument is not an inline function');
    }
    if (fn.isAsync()) return skip('enqueueActions callback is async');
    const [first, second, ...more] = fn.getParameters();
    if (more.length) return skip('enqueueActions callback has extra params');
    const bound = new Map<string, Node>();
    if (first) {
      const pattern = first.getNameNode();
      if (!Node.isObjectBindingPattern(pattern) || first.getInitializer()) {
        return skip(
          'enqueueActions callback does not destructure its argument'
        );
      }
      for (const element of pattern.getElements()) {
        const name = element.getNameNode();
        const key = (element.getPropertyNameNode() ?? name).getText();
        if (
          element.getPropertyNameNode() ||
          element.getInitializer() ||
          element.getDotDotDotToken() ||
          !Node.isIdentifier(name) ||
          !ENQUEUE_ARGS.has(key)
        ) {
          return skip(
            `unsupported enqueueActions binding '${element.getText()}'`
          );
        }
        bound.set(key, name);
      }
    }
    let paramsName: string | undefined;
    if (second) {
      const name = second.getNameNode();
      if (!Node.isIdentifier(name) || second.getInitializer()) {
        return skip('enqueueActions params is not a plain identifier');
      }
      paramsName = name.getText();
    }
    const refsTo = (key: string): Node[] => {
      const id = bound.get(key);
      if (!id) return [];
      const symbol = valueSymbol(id);
      return fn
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .filter((r) => r !== id && valueSymbol(r) === symbol);
    };
    // Calls to replace: enqueue(...), enqueue.x(...), check(...).
    const calls: Array<{ call: Node; kind: string; args: Node[] }> = [];
    for (const ref of refsTo('enqueue')) {
      const parent = ref.getParentOrThrow();
      if (Node.isCallExpression(parent) && parent.getExpression() === ref) {
        calls.push({
          call: parent,
          kind: 'enqueue',
          args: parent.getArguments()
        });
        continue;
      }
      const call = parent.getParent();
      if (
        Node.isPropertyAccessExpression(parent) &&
        Node.isCallExpression(call) &&
        call.getExpression() === parent &&
        ENQUEUE_METHODS.has(parent.getName())
      ) {
        calls.push({ call, kind: parent.getName(), args: call.getArguments() });
        continue;
      }
      return skip('enqueueActions uses `enqueue` other than by calling it');
    }
    for (const ref of refsTo('check')) {
      const parent = ref.getParentOrThrow();
      if (
        !Node.isCallExpression(parent) ||
        parent.getExpression() !== ref ||
        parent.getArguments().length !== 1
      ) {
        return skip('enqueueActions uses `check` other than as check(guard)');
      }
      calls.push({ call: parent, kind: 'check', args: parent.getArguments() });
    }
    const within = (inner: Node, outer: Node) =>
      inner !== outer &&
      inner.getStart() >= outer.getStart() &&
      inner.getEnd() <= outer.getEnd();
    if (calls.some((a) => calls.some((b) => within(a.call, b.call)))) {
      return skip('enqueueActions nests enqueue/check calls');
    }
    const body = fn.getBody();
    if (
      Node.isBlock(body) &&
      body
        .getDescendantsOfKind(SyntaxKind.ReturnStatement)
        .some(
          (r) =>
            r.getFirstAncestor(
              (a) =>
                Node.isArrowFunction(a) ||
                Node.isFunctionExpression(a) ||
                Node.isFunctionDeclaration(a) ||
                Node.isMethodDeclaration(a)
            ) === fn
        )
    ) {
      return skip('enqueueActions callback returns early');
    }
    const hoistable = ['event', 'self', 'system'].filter(
      (k) => refsTo(k).length
    );
    if (hoistable.length && !this.inline) {
      return skip('enqueueActions reads event/self/system shadowed outside');
    }
    const assigns = calls.some(
      (c) =>
        c.kind === 'assign' ||
        (c.kind === 'enqueue' && c.args[0] && this.isAssign(c.args[0]))
    );
    const contextRefs = refsTo('context');
    const needSnapshot = contextRefs.length > 0 && (assigns || br.assigned);
    if (
      needSnapshot &&
      contextRefs.some((r) => calls.some((c) => within(r, c.call)))
    ) {
      return skip(
        'enqueueActions reads `context` inside an enqueue call after an assign'
      );
    }
    for (const k of hoistable) this.hoist.add(k);
    if (contextRefs.length && !needSnapshot) {
      if (!this.inline) {
        return skip('enqueueActions reads `context` shadowed outside');
      }
      this.hoist.add('context');
    }
    const fnText = fn.getText();
    let snapshot = 'contextBefore';
    for (let i = 2; new RegExp(`\\b${snapshot}\\b`).test(fnText); i++) {
      snapshot = `contextBefore${i}`;
    }
    const snapshotValue = br.assigned ? 'context' : 'args.context';
    if (assigns) {
      br.assigned = true;
      br.forcePatch = true;
      this.threaded = true;
    }
    const replacements: Array<{ node: Node; text: string }> = [];
    for (const { call, kind, args } of calls) {
      if (kind === 'check') {
        const cb = new Branch();
        cb.argsOverride = needSnapshot
          ? `{ ...args, context: ${snapshot} }`
          : snapshotValue === 'context'
            ? '{ ...args, context }'
            : 'args';
        const saved = this.inline;
        if (needSnapshot) this.inline = false;
        try {
          const g = this.guard(args[0], cb);
          replacements.push({
            node: call,
            text: g.atomic ? g.text : `(${g.text})`
          });
        } finally {
          this.inline = saved;
        }
        continue;
      }
      const sub = new Branch();
      sub.assigned = br.assigned;
      if (kind === 'enqueue') {
        if (args.length !== 1) return skip('enqueue(...) takes one action');
        this.action(args[0], sub, false);
      } else {
        this.creator(kind, args, sub);
      }
      if (sub.enqueued) br.enqueued = true;
      const lines = threadedLines(sub.entries);
      const statement = call.getParent();
      if (Node.isExpressionStatement(statement) || statement === fn) {
        const target = statement === fn ? call : statement;
        const indent = indentOf(target);
        replacements.push({ node: target, text: lines.join(`\n${indent}`) });
      } else if (
        lines.length === 1 &&
        lines[0].endsWith(';') &&
        typeof sub.entries[0] === 'string'
      ) {
        replacements.push({ node: call, text: lines[0].slice(0, -1) });
      } else {
        return skip('enqueue call is not a statement');
      }
    }
    if (needSnapshot) {
      for (const r of contextRefs) {
        replacements.push({
          node: r,
          text: Node.isShorthandPropertyAssignment(r.getParent())
            ? `context: ${snapshot}`
            : snapshot
        });
      }
    }
    const pre: string[] = [];
    if (needSnapshot) pre.push(`const ${snapshot} = ${snapshotValue};`);
    if (
      paramsName &&
      fn
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((i) => i.getText() === paramsName && i !== second!.getNameNode())
    ) {
      pre.push(`const ${paramsName} = ${this.paramsText ?? 'undefined'};`);
    }
    const statements = Node.isBlock(body) ? body.getStatements() : [body];
    const texts = statements.map((st) => {
      const text = spliceText(st, replacements);
      const indent = indentOf(st);
      const lines = text
        .split('\n')
        .map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l));
      return Node.isBlock(body) || replacements.some((r) => r.node === body)
        ? lines
        : [`${lines.join('\n')};`];
    });
    const declares = statements.some(
      (st) =>
        Node.isVariableStatement(st) ||
        Node.isFunctionDeclaration(st) ||
        Node.isClassDeclaration(st)
    );
    const flat = texts.flatMap((t) => t.flatMap((l) => l.split('\n')));
    if (pre.length || declares) {
      br.push('{', false);
      for (const line of [...pre, ...flat]) br.push(`  ${line}`, false);
      br.push('}', false);
    } else {
      for (const line of flat) br.push(line, false);
    }
  }

  private target(node: Node, br: Branch): string {
    const value = unwrap(node);
    if (Node.isStringLiteral(value)) {
      if (value.getLiteralText().startsWith('#')) {
        return skip(`send target '${value.getLiteralText()}' is a system id`);
      }
      return value.getText();
    }
    return this.dynamic(node, br);
  }

  private namedAction(ref: NameRef, params: Node | undefined, br: Branch) {
    const { name } = ref;
    const def = this.ctx.impls.actions.get(name);
    if (!def) return skip(`action '${name}' is not defined in this file`);
    if (def.kind === 'inline') {
      this.inlineCheck(def, name);
      this.inlinedDefs.add(def);
      const saved = this.paramsText;
      this.paramsText = params ? this.dynamic(params, br) : undefined;
      try {
        return this.action(def.expr!, br, false);
      } finally {
        this.paramsText = saved;
      }
    }
    if (def.kind === 'fn') {
      const p = params ? `, ${this.dynamic(params, br)}` : '';
      return br.push(`enq(args.actions${ref.access}, ${br.argsObj()}${p});`);
    }
    if (def.kind === 'assign') {
      const argsText = mentionsSpawn(def.assignArg!)
        ? spawnArgs(br)
        : br.argsObj();
      const p = params ? `, ${this.dynamic(params, br, argsText)}` : '';
      this.ctx.assignDefs.add(def);
      return br.pushPatch({
        expr: `args.actions${ref.access}(${argsText}${p})`
      });
    }
    return skip(`action '${name}' is not a plain function or assign`);
  }

  private assign(node: Node, br: Branch) {
    const value = unwrap(node);
    const argsText = mentionsSpawn(node) ? spawnArgs(br) : br.argsObj();
    if (Node.isObjectLiteralExpression(value)) {
      const props = value.getProperties().map((property) => {
        if (Node.isShorthandPropertyAssignment(property)) {
          return property.getText();
        }
        const key = getKeyText(property);
        if (!Node.isPropertyAssignment(property) || key === undefined) {
          return skip(`unsupported assign property '${property.getText()}'`);
        }
        return `${property.getNameNode().getText()}: ${this.dynamic(property.getInitializer()!, br, argsText)}`;
      });
      return br.pushPatch({ props: props.join(', ') });
    }
    if (isFunctionLike(value)) {
      const inline = this.inlined(value);
      const body = inline && unwrap(inline.body);
      if (body && Node.isObjectLiteralExpression(body)) {
        return br.pushPatch({
          props: body
            .getProperties()
            .map((p) => p.getText())
            .join(', ')
        });
      }
      if (inline) return br.pushPatch({ expr: paren(inline.body) });
      return br.pushPatch({ expr: `(${value.getText()})(${argsText})` });
    }
    if (Node.isIdentifier(value) && resolveIdentifier(value) === 'fn') {
      return br.pushPatch({ expr: `${value.getText()}(${argsText})` });
    }
    return skip(`unsupported assign argument '${value.getText()}'`);
  }

  // ---- assembly -------------------------------------------------------------

  header(): string[] {
    const names = [...this.hoist].filter(
      (name) => !(this.threaded && name === 'context')
    );
    const lines: string[] = [];
    if (names.length)
      lines.push(`const { ${names.sort().join(', ')} } = args;`);
    if (this.threaded) {
      lines.push('let context = args.context;', 'let patch = {};');
    }
    return lines;
  }
}

/** A reference to a named implementation: its name and how to access it. */
interface NameRef {
  name: string;
  /** `.name`, or `[Expr.X]` when written as a constant expression. */
  access: string;
}

function nameRef(node: Node | undefined): NameRef | undefined {
  if (!node) return undefined;
  const value = unwrap(node);
  const name = resolveStringConstant(value);
  if (name === undefined) return undefined;
  return Node.isStringLiteral(value) ||
    Node.isNoSubstitutionTemplateLiteral(value)
    ? { name, access: access(name) }
    : { name, access: `[${value.getText()}]` };
}

function getInit(object: ObjectLiteralExpression, key: string) {
  const property = object.getProperties().find((p) => getKeyText(p) === key);
  return Node.isPropertyAssignment(property)
    ? property.getInitializer()
    : undefined;
}

function typeAndParams(
  object: ObjectLiteralExpression,
  what: string
): { ref: NameRef; params: Node | undefined } {
  for (const property of object.getProperties()) {
    const key = getKeyText(property);
    if (
      !Node.isPropertyAssignment(property) ||
      (key !== 'type' && key !== 'params')
    ) {
      return skip(`unsupported ${what} object key '${property.getText()}'`);
    }
  }
  const ref = nameRef(getInit(object, 'type'));
  if (!ref) return skip(`${what} object has no string 'type'`);
  return { ref, params: getInit(object, 'params') };
}

function mentionsSpawn(node: Node): boolean {
  return /\bspawn\b/.test(node.getText());
}

function spawnArgs(br: Branch): string {
  return br.assigned
    ? '{ ...args, context, spawn: enq.spawn }'
    : '{ ...args, spawn: enq.spawn }';
}

/** `//` and `/* *\/` comments directly before a node, as written. */
export function leadingComments(node: Node): string[] {
  const text = node.getSourceFile().getFullText();
  return (ts.getLeadingCommentRanges(text, node.getPos()) ?? []).map((range) =>
    text.slice(range.pos, range.end)
  );
}

// ---- transitions ------------------------------------------------------------

export function hasLowerableKeys(object: Node): boolean {
  return (
    Node.isObjectLiteralExpression(object) &&
    object.getProperties().some((property) => {
      const key = getKeyText(property);
      return key === 'actions' || key === 'guard' || key === 'cond';
    })
  );
}

interface LoweredBranch {
  guard?: { text: string; atomic: boolean };
  description?: string;
  comments: string[];
  lines: string[];
  enqueued: boolean;
  returnFields: string[];
}

function lowerBranch(
  fb: FunctionBuilder,
  object: ObjectLiteralExpression
): LoweredBranch {
  const comments: string[] = [];
  let description: string | undefined;
  for (const property of object.getProperties()) {
    const key = getKeyText(property);
    if (key === 'cond') {
      return skip(
        '`cond` is a v4 key that v5 rejects in development and ignores in production'
      );
    }
    if (
      !key ||
      !TRANSITION_KEYS.has(key) ||
      !Node.isPropertyAssignment(property)
    ) {
      return skip(`unsupported transition key '${property.getText()}'`);
    }
    comments.push(...leadingComments(property));
    if (key === 'description') {
      const value = unwrap(property.getInitializer()!);
      description =
        Node.isStringLiteral(value) ||
        Node.isNoSubstitutionTemplateLiteral(value)
          ? value.getLiteralText()
          : value.getText();
    }
  }
  const br = new Branch();
  const guardNode = getInit(object, 'guard');
  const guard = guardNode ? fb.guard(guardNode, br) : undefined;
  fb.actions(getInit(object, 'actions'), br);
  const returnFields: string[] = [];
  for (const key of ['target', 'reenter', 'meta']) {
    const value = getInit(object, key);
    if (value) returnFields.push(`${key}: ${value.getText()}`);
  }
  const { lines, context } = br.finish(fb);
  if (context) returnFields.push(context);
  return {
    guard,
    description,
    comments,
    lines,
    enqueued: br.enqueued,
    returnFields
  };
}

const descriptionComments = (description: string | undefined) =>
  description === undefined
    ? []
    : description.split(/\r?\n/).map((line) => `// ${line}`.trimEnd());

const returnStatement = (fields: string[]) =>
  fields.length ? `return { ${fields.join(', ')} };` : 'return {};';

export interface Lowered {
  /** Lines of the function body, without the outer indentation. */
  body: string[];
  /** Comment lines to place above the property (single transitions only). */
  above: string[];
  notes: string[];
  /** Named definitions inlined at this site. */
  inlined: Set<ImplDef>;
  constRefs: Map<Node, Node[]>;
}

/** Rewrites `const x = raise(...)` (or another creator) as `(args, enq) => {...}`. */
export function lowerConstCreator(
  ctx: FileContext,
  call: Node
): string | undefined {
  try {
    const fb = new FunctionBuilder(ctx, call);
    const br = new Branch();
    fb.actions(call, br);
    const { lines, context } = br.finish(fb);
    if (context) return undefined;
    return [
      '(args, enq) => {',
      ...[...fb.header(), ...lines].map((l) => `  ${l}`),
      '}'
    ].join('\n');
  } catch (error) {
    if (error instanceof Skip) return undefined;
    throw error;
  }
}

/** Lowers a transition object or array to a function body. */
export function lowerTransition(ctx: FileContext, value: Node): Lowered {
  const fb = new FunctionBuilder(ctx, value);
  const notes: string[] = [];
  if (Node.isObjectLiteralExpression(value)) {
    const b = lowerBranch(fb, value);
    const body = [...b.comments];
    if (b.guard) {
      const { text, atomic } = b.guard;
      body.push(`if (!${atomic ? text : `(${text})`}) return;`);
    }
    body.push(...b.lines);
    if (b.returnFields.length || !b.enqueued) {
      body.push(returnStatement(b.returnFields));
    }
    return {
      body: [...fb.header(), ...body],
      above: descriptionComments(b.description),
      notes,
      inlined: fb.inlinedDefs,
      constRefs: fb.constRefs
    };
  }
  if (!Node.isArrayLiteralExpression(value)) {
    return skip('transition is not an object or array');
  }
  const body: string[] = [];
  const elements = value.getElements();
  for (let i = 0; i < elements.length; i++) {
    const element = unwrap(elements[i]);
    if (!Node.isObjectLiteralExpression(element)) {
      return skip('transition array element is not an object literal');
    }
    const b = lowerBranch(fb, element);
    const inner = [
      ...leadingComments(elements[i]),
      ...descriptionComments(b.description),
      ...b.comments,
      ...b.lines,
      returnStatement(b.returnFields)
    ];
    if (!b.guard) {
      body.push(...inner);
      if (i < elements.length - 1) {
        notes.push(
          `dropped ${elements.length - 1 - i} unreachable transition candidate(s) after an unguarded one`
        );
      }
      break;
    }
    body.push(
      `if (${b.guard.text}) {`,
      ...inner.map((line) => `  ${line}`),
      '}'
    );
  }
  return {
    body: [...fb.header(), ...body],
    above: [],
    notes,
    inlined: fb.inlinedDefs,
    constRefs: fb.constRefs
  };
}

/** Lowers an `entry`/`exit` value to a function body. */
export function lowerEntryExit(ctx: FileContext, value: Node): Lowered {
  const fb = new FunctionBuilder(ctx, value);
  const br = new Branch();
  fb.actions(value, br);
  const { lines, context } = br.finish(fb);
  const body = [...lines];
  if (context) body.push(`return { ${context} };`);
  return {
    body: [...fb.header(), ...body],
    above: [],
    notes: [],
    inlined: fb.inlinedDefs,
    constRefs: fb.constRefs
  };
}

/** Rewrites a named `assign(...)` definition as a patch-returning function. */
export function lowerAssignDefinition(def: ImplDef): string | undefined {
  const arg = unwrap(def.assignArg!);
  if (isFunctionLike(arg)) return def.assignArg!.getText();
  if (Node.isIdentifier(arg) && resolveIdentifier(arg) === 'fn') {
    return arg.getText();
  }
  if (!Node.isObjectLiteralExpression(arg)) return undefined;
  const props = arg.getProperties();
  if (
    props.some(
      (p) =>
        !Node.isPropertyAssignment(p) && !Node.isShorthandPropertyAssignment(p)
    )
  )
    return undefined;
  const inlineOk =
    outerReferences(arg, new Set([...HOISTABLE, 'args', 'params'])).size === 0;
  const names = new Set<string>();
  const inlined = props.map((p) => {
    if (!Node.isPropertyAssignment(p)) return p.getText();
    const value = unwrap(p.getInitializer()!);
    if (!isFunctionLike(value)) return p.getText();
    const inline = inlineOk ? inlineable(value) : undefined;
    if (!inline) return undefined;
    inline.names.forEach((n) => names.add(n));
    return `${p.getNameNode().getText()}: ${inline.body.getText()}`;
  });
  if (inlined.every((p) => p !== undefined)) {
    const param = names.size ? `{ ${[...names].sort().join(', ')} }` : '';
    return `(${param}) => ({ ${inlined.join(', ')} })`;
  }
  if (outerReferences(arg, new Set(['args', 'params'])).size) return undefined;
  const generic = props.map((p) => {
    if (!Node.isPropertyAssignment(p)) return p.getText();
    const value = unwrap(p.getInitializer()!);
    if (!isFunctionLike(value)) return p.getText();
    return `${p.getNameNode().getText()}: (${value.getText()})(args, params)`;
  });
  return `(args, params) => ({ ${generic.join(', ')} })`;
}
