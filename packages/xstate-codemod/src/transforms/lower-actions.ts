import {
  CallExpression,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  SyntaxKind,
  VariableDeclaration
} from 'ts-morph';
import type { Transform, TransformResult } from '../types.ts';
import { ensureNamedImport, findMachineConfigObjects } from '../util.ts';
import {
  Skip,
  getKeyText,
  getProperty,
  getXstateImports,
  isFunctionLike,
  resolveConstInitializer,
  resolveStringConstant,
  derefConfig,
  isIndirect,
  onlyConfigReferences,
  unwrap,
  xstateCallee,
  collectImplementations,
  type ImplDef
} from './lower-actions/analysis.ts';
import {
  type FileContext,
  type Lowered,
  MATCHES_STATE,
  hasLowerableKeys,
  lowerAssignDefinition,
  lowerConstCreator,
  lowerEntryExit,
  lowerTransition
} from './lower-actions/codegen.ts';

interface Edit {
  start: number;
  end: number;
  text: string;
}

const IMPLEMENTATION_KEYS = new Set(['actions', 'guards', 'actors', 'delays']);

/** Action creators and helpers this transform can leave unreferenced. */
const REMOVABLE_IMPORTS = new Set([
  'assign',
  'raise',
  'sendTo',
  'sendParent',
  'forwardTo',
  'emit',
  'log',
  'cancel',
  'stopChild',
  'stop',
  'spawnChild',
  'enqueueActions',
  'and',
  'or',
  'not',
  'stateIn',
  'fromPromise'
]);

function applyEdits(sourceFile: SourceFile, edits: Edit[]): boolean {
  if (!edits.length) return false;
  // Keep outermost edits only; nested ones are part of a replaced range.
  const sorted = [...edits].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Edit[] = [];
  for (const edit of sorted) {
    const last = kept[kept.length - 1];
    if (last && edit.start < last.end) continue;
    kept.push(edit);
  }
  let text = sourceFile.getFullText();
  for (const edit of kept.reverse()) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  }
  sourceFile.replaceWithText(text);
  return true;
}

function indentAt(sourceFile: SourceFile, pos: number): string {
  const text = sourceFile.getFullText();
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))![0];
}

function where(sourceFile: SourceFile, node: Node): string {
  const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
  return `${sourceFile.getFilePath()}:${line}:${column}`;
}

/** Appends property texts to an object literal, keeping its layout. */
function appendProperties(
  sourceFile: SourceFile,
  object: ObjectLiteralExpression,
  texts: string[]
): Edit {
  const last = object.getProperties().at(-1);
  if (!last) {
    const indent = indentAt(sourceFile, object.getStart());
    return {
      start: object.getStart() + 1,
      end: object.getEnd() - 1,
      text: `\n${texts.map((t) => `${indent}  ${t}`).join(',\n')}\n${indent}`
    };
  }
  const indent = indentAt(sourceFile, last.getStart());
  return {
    start: last.getEnd(),
    end: last.getEnd(),
    text: texts.map((t) => `,\n${indent}${t}`).join('')
  };
}

// ---- F: move createMachine's second argument into the config -----------------

function moveImplementations(sourceFile: SourceFile, notes: string[]): boolean {
  const edits: Edit[] = [];
  for (const call of sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression
  )) {
    const expr = call.getExpression();
    const name = Node.isIdentifier(expr)
      ? expr.getText()
      : Node.isPropertyAccessExpression(expr)
        ? expr.getName()
        : undefined;
    const args = call.getArguments();
    if (name !== 'createMachine' || args.length !== 2) continue;
    const [config, impls] = args.map(unwrap);
    if (
      !Node.isObjectLiteralExpression(config) ||
      !Node.isObjectLiteralExpression(impls)
    ) {
      notes.push(
        `${where(sourceFile, args[1])} — left the second createMachine argument: not an object literal`
      );
      continue;
    }
    const plan: Edit[] = [];
    const newKeys: string[] = [];
    let ok = true;
    for (const property of impls.getProperties()) {
      const key = getKeyText(property);
      if (
        !key ||
        !IMPLEMENTATION_KEYS.has(key) ||
        !(
          Node.isPropertyAssignment(property) ||
          Node.isShorthandPropertyAssignment(property)
        )
      ) {
        ok = false;
        break;
      }
      const existing = getProperty(config, key);
      if (!existing) {
        newKeys.push(property.getText());
        continue;
      }
      const value = Node.isPropertyAssignment(property)
        ? unwrap(property.getInitializer()!)
        : undefined;
      const target = unwrap(existing);
      if (
        !value ||
        !Node.isObjectLiteralExpression(value) ||
        !Node.isObjectLiteralExpression(target)
      ) {
        ok = false;
        break;
      }
      const texts = value.getProperties().map((p) => p.getText());
      if (texts.length) plan.push(appendProperties(sourceFile, target, texts));
    }
    if (!ok) {
      notes.push(
        `${where(sourceFile, args[1])} — left the second createMachine argument: keys other than actions/guards/actors/delays, or a non-literal map`
      );
      continue;
    }
    if (newKeys.length)
      plan.push(appendProperties(sourceFile, config, newKeys));
    plan.push({ start: args[0].getEnd(), end: args[1].getEnd(), text: '' });
    edits.push(...plan);
    notes.push(
      `${where(sourceFile, args[1])} — moved the second createMachine argument into the config`
    );
  }
  return applyEdits(sourceFile, edits);
}

// ---- A–E: transitions and entry/exit --------------------------------------------

function render(
  sourceFile: SourceFile,
  property: Node,
  value: Node,
  lowered: Lowered
): Edit {
  const indent = indentAt(sourceFile, property.getStart());
  const text = lowered.body.join('\n');
  const usesEnq = /\benq\b/.test(text);
  const params = usesEnq
    ? '(args, enq)'
    : /\bargs\b/.test(text)
      ? '(args)'
      : '()';
  const fn = [
    `${params} => {`,
    ...lowered.body.map((line) => `${indent}  ${line}`),
    `${indent}}`
  ].join('\n');
  if (!lowered.above.length || !Node.isPropertyAssignment(property)) {
    return { start: value.getStart(), end: value.getEnd(), text: fn };
  }
  return {
    start: property.getStart(),
    end: value.getEnd(),
    text: `${lowered.above.join(`\n${indent}`)}\n${indent}${property.getNameNode().getText()}: ${fn}`
  };
}

function lowerMachines(sourceFile: SourceFile, notes: string[]): boolean {
  // A module-level action const is rewritten only when every reference to it
  // is a call site that got lowered; otherwise plan again without it.
  const disabledConsts = new Set<Node>();
  for (;;) {
    const plan = planMachines(sourceFile, disabledConsts);
    if (plan.edits) {
      notes.push(...plan.notes);
      return applyEdits(sourceFile, plan.edits);
    }
  }
}

function planMachines(
  sourceFile: SourceFile,
  disabledConsts: Set<Node>
): { edits?: Edit[]; notes: string[] } {
  const notes: string[] = [];
  const xs = getXstateImports(sourceFile);
  const edits: Edit[] = [];
  const assignDefs = new Set<ImplDef>();
  const constRefs = new Map<Node, Set<Node>>();

  const inlined = new Map<Node, string>();
  const attempt = (property: Node, value: Node, lower: () => Lowered) => {
    try {
      const lowered = lower();
      edits.push(render(sourceFile, property, value, lowered));
      for (const def of lowered.inlined) {
        inlined.set(def.property, implName(def));
      }
      for (const [decl, ids] of lowered.constRefs) {
        const set = constRefs.get(decl) ?? new Set();
        ids.forEach((id) => set.add(id));
        constRefs.set(decl, set);
      }
      for (const note of lowered.notes) {
        notes.push(`${where(sourceFile, value)} — ${note}`);
      }
    } catch (error) {
      if (!(error instanceof Skip)) throw error;
      notes.push(`${where(sourceFile, value)} — not lowered: ${error.message}`);
    }
  };

  for (const config of findMachineConfigObjects(sourceFile)) {
    const impls = collectImplementations(config, xs);
    const rewrites = new Map<ImplDef, string>();
    for (const def of impls.actions.values()) {
      if (def.kind !== 'assign') continue;
      const text = lowerAssignDefinition(def);
      if (text === undefined) def.kind = 'other';
      else rewrites.set(def, text);
    }
    const ctx: FileContext = { xs, impls, assignDefs, disabledConsts };

    /** Literal behind an in-file const reference, when safe to edit in place. */
    const resolve = (value: Node): Node | undefined => {
      if (!isIndirect(value)) return value;
      const target = derefConfig(value);
      if (!target) return value;
      if (!onlyConfigReferences(target.decl)) return undefined;
      return target.node;
    };

    const transition = (property: Node, value: Node | undefined) => {
      if (!value) return;
      if (isIndirect(value)) {
        const target = resolve(value);
        if (!target || target === value || isFunctionLike(target)) return;
        // Lowered in place inside the const: replace the literal only.
        return transition(target, target);
      }
      const v = unwrap(value);
      const candidates = Node.isArrayLiteralExpression(v)
        ? v.getElements().map(unwrap)
        : [v];
      if (!candidates.some(hasLowerableKeys)) {
        if (Node.isArrayLiteralExpression(v)) collapseArray(v, candidates);
        return;
      }
      attempt(property, value, () => lowerTransition(ctx, v));
    };

    // v5 takes the first enabled candidate; with no guards that is always the
    // first one, so the rest are unreachable.
    const collapseArray = (array: Node, candidates: Node[]) => {
      const [first] = candidates;
      if (
        !first ||
        !candidates.every(
          (c) =>
            Node.isObjectLiteralExpression(c) ||
            Node.isStringLiteral(c) ||
            Node.isNoSubstitutionTemplateLiteral(c)
        )
      )
        return;
      edits.push({
        start: array.getStart(),
        end: array.getEnd(),
        text: first.getText()
      });
      if (candidates.length > 1) {
        notes.push(
          `${where(sourceFile, array)} — collapsed an unguarded transition array to its first candidate; v5 never reaches the other ${candidates.length - 1}`
        );
      }
    };

    const transitionMap = (map: Node | undefined) => {
      const value = map && resolve(map);
      if (!value || !Node.isObjectLiteralExpression(value)) return;
      for (const property of value.getProperties()) {
        if (Node.isPropertyAssignment(property)) {
          transition(property, property.getInitializer());
        } else if (Node.isSpreadAssignment(property)) {
          transitionMap(property);
        }
      }
    };

    const visitState = (node: Node | undefined) => {
      const state = node && resolve(node);
      if (!state || !Node.isObjectLiteralExpression(state)) return;
      for (const property of state.getProperties()) {
        if (Node.isSpreadAssignment(property)) {
          visitState(property);
          continue;
        }
        const key = getKeyText(property);
        if (!key || !Node.isPropertyAssignment(property)) continue;
        const value = property.getInitializer();
        if (!value) continue;
        switch (key) {
          case 'entry':
          case 'exit': {
            const target = resolve(value);
            if (target && !isFunctionLike(unwrap(target))) {
              const at = target === value ? property : target;
              attempt(at, target, () => lowerEntryExit(ctx, target));
            }
            break;
          }
          case 'on':
          case 'after':
            transitionMap(value);
            break;
          case 'always':
          case 'onDone':
          case 'onError':
          case 'onSnapshot':
            transition(property, value);
            break;
          case 'invoke': {
            const list = resolve(value);
            const invokes = !list
              ? []
              : Node.isArrayLiteralExpression(list)
                ? list.getElements().map(resolve)
                : [list];
            for (const invoke of invokes) {
              if (!invoke || !Node.isObjectLiteralExpression(invoke)) continue;
              for (const p of invoke.getProperties()) {
                const k = getKeyText(p);
                if (
                  Node.isPropertyAssignment(p) &&
                  (k === 'onDone' || k === 'onError' || k === 'onSnapshot')
                ) {
                  transition(p, p.getInitializer());
                }
              }
            }
            break;
          }
          case 'states':
            visitStates(value);
            break;
        }
      }
    };

    const visitStates = (node: Node) => {
      const states = resolve(node);
      if (!states || !Node.isObjectLiteralExpression(states)) return;
      for (const child of states.getProperties()) {
        if (Node.isPropertyAssignment(child)) {
          visitState(child.getInitializer());
        } else if (Node.isShorthandPropertyAssignment(child)) {
          visitState(child);
        } else if (Node.isSpreadAssignment(child)) {
          visitStates(child);
        }
      }
    };

    visitState(config);

    for (const [def, text] of rewrites) {
      if (!Node.isPropertyAssignment(def.property)) continue;
      const init = def.property.getInitializer()!;
      edits.push({ start: init.getStart(), end: init.getEnd(), text });
    }
  }

  let retry = false;
  for (const [decl, ids] of constRefs) {
    const declaration = decl as VariableDeclaration;
    const nameNode = declaration.getNameNode();
    const symbol = nameNode.getSymbol();
    const unlowered = sourceFile
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .some(
        (id) =>
          id !== nameNode &&
          id.getText() === nameNode.getText() &&
          id.getSymbol() === symbol &&
          !ids.has(id)
      );
    const call = unwrap(declaration.getInitializer()!) as CallExpression;
    const text = unlowered
      ? undefined
      : xstateCallee(call, xs) === 'assign'
        ? call.getArguments().length !== 1
          ? undefined
          : lowerAssignDefinition({
              kind: 'assign',
              property: decl,
              assignArg: call.getArguments()[0]
            })
        : lowerConstCreator(
            {
              xs,
              impls: { actions: new Map(), guards: new Map() },
              assignDefs,
              disabledConsts
            },
            call
          );
    if (text === undefined) {
      disabledConsts.add(decl);
      retry = true;
      continue;
    }
    const init = declaration.getInitializer()!;
    edits.push({ start: init.getStart(), end: init.getEnd(), text });
    notes.push(
      `${where(sourceFile, decl)} — rewrote '${nameNode.getText()}' as a function its call sites invoke`
    );
  }
  if (retry) return { notes };

  // Definitions only referenced from other removed definitions go too.
  const removed: Node[] = [];
  for (let grew = true; grew;) {
    grew = false;
    const ranges = [
      ...edits,
      ...removed.map((p) => ({ start: p.getStart(), end: p.getEnd() }))
    ];
    for (const [property, name] of inlined) {
      if (removed.includes(property)) continue;
      if (!hasOtherReferences(sourceFile, name, property, ranges)) {
        removed.push(property);
        grew = true;
      }
    }
  }
  for (const [property, name] of inlined) {
    if (!removed.includes(property)) {
      notes.push(
        `${where(sourceFile, property)} — kept '${name}': referenced where it was not inlined`
      );
    }
  }
  edits.push(...removeProperties(removed));

  return { edits, notes };
}

function implName(def: ImplDef): string {
  const name = (def.property as PropertyAssignment).getNameNode();
  return Node.isComputedPropertyName(name)
    ? (resolveStringConstant(name.getExpression()) ?? '')
    : (getKeyText(def.property) ?? '');
}

/** Whether `name` still appears outside `def` and the replaced ranges. */
function hasOtherReferences(
  sourceFile: SourceFile,
  name: string,
  def: Node,
  edits: Array<{ start: number; end: number }>
): boolean {
  const replaced = (node: Node) =>
    (node.getStart() >= def.getStart() && node.getEnd() <= def.getEnd()) ||
    edits.some((e) => node.getStart() >= e.start && node.getEnd() <= e.end);
  return (
    sourceFile.forEachDescendant((node) => {
      const matches =
        ((Node.isStringLiteral(node) ||
          Node.isNoSubstitutionTemplateLiteral(node)) &&
          node.getLiteralText() === name) ||
        (Node.isIdentifier(node) && node.getText() === name) ||
        (Node.isPropertyAccessExpression(node) &&
          resolveStringConstant(node) === name);
      return matches && !replaced(node) ? true : undefined;
    }) ?? false
  );
}

/** Deletes object literal properties with their separating commas. */
function removeProperties(properties: Node[]): Edit[] {
  const edits: Edit[] = [];
  const objects = new Set(properties.map((p) => p.getParentOrThrow()));
  for (const object of objects) {
    if (!Node.isObjectLiteralExpression(object)) continue;
    const props: Node[] = object.getProperties();
    const gone = props.map((p) => properties.includes(p));
    if (gone.every(Boolean)) {
      edits.push({
        start: object.getStart() + 1,
        end: object.getEnd() - 1,
        text: ''
      });
      continue;
    }
    const lastKept = gone.lastIndexOf(false);
    props.forEach((p, i) => {
      if (gone[i] && i < lastKept) {
        edits.push({
          start: p.getFullStart(),
          end: props[i + 1].getFullStart(),
          text: ''
        });
      }
    });
    if (lastKept < props.length - 1) {
      edits.push({
        start: props[lastKept].getEnd(),
        end: props.at(-1)!.getEnd(),
        text: ''
      });
    }
  }
  return edits;
}

// ---- F: fromPromise → createAsyncLogic ---------------------------------------

function promiseFunction(arg: Node): Node | undefined {
  const value = unwrap(arg);
  if (isFunctionLike(value)) return value;
  if (Node.isIdentifier(value)) {
    const init = resolveConstInitializer(value);
    if (init && isFunctionLike(init)) return init;
    const decl = value
      .getSymbol()
      ?.getDeclarations()
      .find(Node.isFunctionDeclaration);
    return decl;
  }
  return undefined;
}

function usesSystemOrEmit(fn: Node): boolean {
  if (
    !Node.isArrowFunction(fn) &&
    !Node.isFunctionExpression(fn) &&
    !Node.isFunctionDeclaration(fn)
  )
    return true;
  const [param, ...rest] = fn.getParameters();
  if (rest.length) return true;
  if (!param) return false;
  const name = param.getNameNode();
  if (Node.isObjectBindingPattern(name)) {
    return name.getElements().some((element) => {
      const key = (
        element.getPropertyNameNode() ?? element.getNameNode()
      ).getText();
      return (
        !!element.getDotDotDotToken() || key === 'system' || key === 'emit'
      );
    });
  }
  return /\b(system|emit)\b/.test(fn.getText());
}

function lowerFromPromise(sourceFile: SourceFile, notes: string[]): boolean {
  const find = () => {
    const xs = getXstateImports(sourceFile);
    return sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => {
        if (xstateCallee(call, xs) !== 'fromPromise') return false;
        const args = call.getArguments();
        const fn = args.length === 1 && promiseFunction(args[0]);
        if (!fn || usesSystemOrEmit(fn)) {
          notes.push(
            `${where(sourceFile, call)} — not lowered: fromPromise logic reads \`system\` or \`emit\`, or is not a local function`
          );
          return false;
        }
        return true;
      });
  };
  if (!find().length) return false;
  const local = ensureNamedImport(sourceFile, 'createAsyncLogic');
  if (!local) return false;
  const calls: CallExpression[] = find().reverse();
  for (const call of calls) {
    call.replaceWithText(
      `${local}({ run: ${call.getArguments()[0].getText()} })`
    );
  }
  return true;
}

// ---- G: imports -----------------------------------------------------------------

function cleanupImports(sourceFile: SourceFile) {
  const references = new Map<string, number>();
  for (const id of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) continue;
    const parent = id.getParent();
    if (
      (Node.isPropertyAssignment(parent) ||
        Node.isPropertyAccessExpression(parent) ||
        Node.isMethodDeclaration(parent) ||
        Node.isPropertySignature(parent)) &&
      parent.getNameNode() === id
    )
      continue;
    references.set(id.getText(), (references.get(id.getText()) ?? 0) + 1);
  }
  for (const imp of sourceFile.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() !== 'xstate') continue;
    for (const spec of imp.getNamedImports()) {
      const local = (spec.getAliasNode() ?? spec.getNameNode()).getText();
      if (REMOVABLE_IMPORTS.has(spec.getName()) && !references.get(local)) {
        spec.remove();
      }
    }
    if (
      !imp.getNamedImports().length &&
      !imp.getDefaultImport() &&
      !imp.getNamespaceImport()
    ) {
      imp.remove();
    }
  }
}

/**
 * Lowers v5 action creators, guards and transition objects to v6 transition
 * and entry/exit functions. Anything it cannot lower is left untouched for the
 * report transforms.
 */
export const lowerActions: Transform = {
  name: 'lower-actions',
  description:
    'Rewrite v5 transition `actions`/`guard`, `entry`/`exit` lists, action creators, guard combinators, named `assign` actions, the second `createMachine` argument and `fromPromise` as v6 functions.',
  apply(sourceFile: SourceFile): TransformResult {
    const before = sourceFile.getFullText();
    const notes: string[] = [];
    let changed = moveImplementations(sourceFile, notes);
    changed = lowerMachines(sourceFile, notes) || changed;
    changed = lowerFromPromise(sourceFile, notes) || changed;
    if (sourceFile.getFullText().includes(MATCHES_STATE)) {
      const local =
        ensureNamedImport(sourceFile, 'matchesState') ?? 'matchesState';
      sourceFile.replaceWithText(
        sourceFile.getFullText().split(MATCHES_STATE).join(local)
      );
    }
    if (changed) cleanupImports(sourceFile);
    return { changed: sourceFile.getFullText() !== before, notes };
  }
};
