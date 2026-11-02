import {
  CallExpression,
  Node,
  ObjectLiteralExpression,
  SourceFile,
  SyntaxKind,
  ts
} from 'ts-morph';

/** Thrown to abandon lowering of one node; the report transforms then flag it. */
export class Skip extends Error {}

export const skip = (reason: string): never => {
  throw new Skip(reason);
};

/** Local name → imported name, for value imports from `'xstate'`. */
export function getXstateImports(sourceFile: SourceFile): Map<string, string> {
  const map = new Map<string, string>();
  for (const imp of sourceFile.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() !== 'xstate' || imp.isTypeOnly())
      continue;
    for (const spec of imp.getNamedImports()) {
      if (spec.isTypeOnly()) continue;
      const local = (spec.getAliasNode() ?? spec.getNameNode()).getText();
      map.set(local, spec.getName());
    }
  }
  return map;
}

/** The `'xstate'` export a call invokes, e.g. `assign` for `assign(...)`. */
export function xstateCallee(
  node: Node,
  xs: Map<string, string>
): string | undefined {
  if (!Node.isCallExpression(node)) return undefined;
  const expr = node.getExpression();
  return Node.isIdentifier(expr) ? xs.get(expr.getText()) : undefined;
}

export function getKeyText(node: Node): string | undefined {
  if (
    !Node.isPropertyAssignment(node) &&
    !Node.isMethodDeclaration(node) &&
    !Node.isShorthandPropertyAssignment(node)
  )
    return undefined;
  const name = node.getNameNode();
  if (Node.isStringLiteral(name) || Node.isNoSubstitutionTemplateLiteral(name))
    return name.getLiteralText();
  if (Node.isIdentifier(name) || Node.isNumericLiteral(name))
    return name.getText();
  return undefined;
}

export function getProperty(object: Node, key: string): Node | undefined {
  if (!Node.isObjectLiteralExpression(object)) return undefined;
  const property = object
    .getProperties()
    .find((candidate) => getKeyText(candidate) === key);
  return Node.isPropertyAssignment(property)
    ? property.getInitializer()
    : undefined;
}

export function isFunctionLike(node: Node | undefined): boolean {
  return (
    !!node && (Node.isArrowFunction(node) || Node.isFunctionExpression(node))
  );
}

/** `.name` or `['na me']`. */
export function access(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name)
    ? `.${name}`
    : `[${JSON.stringify(name)}]`;
}

export type ImplKind = 'fn' | 'assign' | 'inline' | 'other';
export interface ImplDef {
  kind: ImplKind;
  /** For `inline`: the creator/combinator call lowered at each call site. */
  expr?: Node;
  /** The property (assignment or method) declaring the implementation. */
  property: Node;
  /** For `assign(...)`: the argument. */
  assignArg?: Node;
}

/** Guard combinators a named guard may be defined as, inlined at call sites. */
const INLINE_GUARDS = new Set(['and', 'or', 'not', 'stateIn']);

function classify(
  property: Node,
  xs: Map<string, string>,
  group: 'actions' | 'guards'
): ImplDef {
  if (Node.isMethodDeclaration(property)) return { kind: 'fn', property };
  if (Node.isShorthandPropertyAssignment(property)) {
    return {
      kind: resolveIdentifier(property.getNameNode()) === 'fn' ? 'fn' : 'other',
      property
    };
  }
  if (!Node.isPropertyAssignment(property)) return { kind: 'other', property };
  const value = unwrap(property.getInitializer()!);
  if (isFunctionLike(value)) return { kind: 'fn', property };
  if (xstateCallee(value, xs) === 'assign') {
    const arg = (value as CallExpression).getArguments()[0];
    if (arg) return { kind: 'assign', property, assignArg: arg };
  }
  if (Node.isIdentifier(value) && resolveIdentifier(value) === 'fn') {
    return { kind: 'fn', property };
  }
  const callee = xstateCallee(value, xs);
  if (group === 'guards' && callee && INLINE_GUARDS.has(callee)) {
    return { kind: 'inline', property, expr: value };
  }
  return { kind: 'other', property };
}

/** Strips `as` / `satisfies` / parentheses. */
export function unwrap(node: Node): Node {
  let current = node;
  while (
    Node.isAsExpression(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isParenthesizedExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
}

export interface Implementations {
  actions: Map<string, ImplDef>;
  guards: Map<string, ImplDef>;
}

function collectFrom(
  impls: Implementations,
  object: Node | undefined,
  xs: Map<string, string>
) {
  if (!object || !Node.isObjectLiteralExpression(object)) return;
  for (const group of ['actions', 'guards'] as const) {
    const map = getProperty(object, group);
    if (!map || !Node.isObjectLiteralExpression(map)) continue;
    for (const property of map.getProperties()) {
      const key = implKey(property);
      if (key === undefined || impls[group].has(key)) continue;
      impls[group].set(key, classify(property, xs, group));
    }
  }
}

/** Finds the `setup({...})` argument a `createMachine`/`createStateConfig` call is chained to. */
function findSetupArgument(config: ObjectLiteralExpression): Node | undefined {
  const call = config.getParent();
  if (!Node.isCallExpression(call)) return undefined;
  const expr = call.getExpression();
  if (!Node.isPropertyAccessExpression(expr)) return undefined;
  let receiver: Node = expr.getExpression();
  if (Node.isIdentifier(receiver)) {
    const decl = receiver
      .getSymbol()
      ?.getDeclarations()
      .find(Node.isVariableDeclaration);
    const init = decl?.getInitializer();
    if (!init) return undefined;
    receiver = init;
  }
  if (!Node.isCallExpression(receiver)) return undefined;
  const callee = receiver.getExpression();
  if (!Node.isIdentifier(callee) || callee.getText() !== 'setup')
    return undefined;
  return receiver.getArguments()[0];
}

/** Named implementations visible to a machine config: its own top-level keys, then `setup`. */
export function collectImplementations(
  config: ObjectLiteralExpression,
  xs: Map<string, string>
): Implementations {
  const impls: Implementations = { actions: new Map(), guards: new Map() };
  collectFrom(impls, config, xs);
  collectFrom(impls, findSetupArgument(config), xs);
  return impls;
}

/** What an identifier's in-file declaration is: a function, a plain value, or unknown. */
export function resolveIdentifier(id: Node): 'fn' | 'value' | 'unknown' {
  const parent = id.getParent();
  const symbol = Node.isShorthandPropertyAssignment(parent)
    ? parent.getValueSymbol()
    : id.getSymbol();
  const decls = symbol?.getDeclarations() ?? [];
  if (decls.length !== 1) return 'unknown';
  const decl = decls[0];
  if (Node.isFunctionDeclaration(decl)) return 'fn';
  if (!Node.isVariableDeclaration(decl)) return 'unknown';
  const list = decl.getParent();
  if (
    Node.isVariableDeclarationList(list) &&
    !(list.getFlags() & 2) /* NodeFlags.Const */
  )
    return 'unknown';
  const init = decl.getInitializer();
  if (!init) return 'unknown';
  const value = unwrap(init);
  if (isFunctionLike(value)) return 'fn';
  if (
    Node.isObjectLiteralExpression(value) ||
    Node.isArrayLiteralExpression(value) ||
    Node.isStringLiteral(value) ||
    Node.isNumericLiteral(value) ||
    Node.isNoSubstitutionTemplateLiteral(value) ||
    Node.isTemplateExpression(value)
  )
    return 'value';
  return 'unknown';
}

/** Initializer of an identifier's single `const` declaration in this file. */
export function resolveConstInitializer(id: Node): Node | undefined {
  const decls = id.getSymbol()?.getDeclarations() ?? [];
  if (decls.length !== 1 || !Node.isVariableDeclaration(decls[0]))
    return undefined;
  const init = decls[0].getInitializer();
  return init && unwrap(init);
}

function isReferenceIdentifier(id: Node): boolean {
  const parent = id.getParent();
  if (!parent) return false;
  if (
    (Node.isPropertyAssignment(parent) ||
      Node.isPropertySignature(parent) ||
      Node.isMethodDeclaration(parent) ||
      Node.isPropertyDeclaration(parent)) &&
    parent.getNameNode() === id
  )
    return false;
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id)
    return false;
  if (Node.isBindingElement(parent) && parent.getPropertyNameNode() === id)
    return false;
  if (Node.isQualifiedName(parent) && parent.getRight() === id) return false;
  if (Node.isTypeReference(parent)) return false;
  return true;
}

/**
 * Names in `names` that `node` references while declared outside it (or not
 * at all, such as globals). Generated bindings with these names would capture
 * those references.
 */
export function outerReferences(node: Node, names: Set<string>): Set<string> {
  const found = new Set<string>();
  const start = node.getPos();
  const end = node.getEnd();
  for (const id of node.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const text = id.getText();
    if (!names.has(text) || !isReferenceIdentifier(id)) continue;
    const parent = id.getParent();
    const symbol = Node.isShorthandPropertyAssignment(parent)
      ? id
          .getProject()
          .getTypeChecker()
          .compilerObject.getShorthandAssignmentValueSymbol(parent.compilerNode)
      : id.getSymbol()?.compilerSymbol;
    const decls = symbol?.declarations ?? [];
    if (
      !decls.length ||
      decls.some((decl) => decl.pos < start || decl.end > end)
    ) {
      found.add(text);
    }
  }
  return found;
}

/** Key of an implementation map entry, resolving `[Enum.X]` computed keys. */
function implKey(property: Node): string | undefined {
  if (
    (Node.isPropertyAssignment(property) ||
      Node.isMethodDeclaration(property)) &&
    Node.isComputedPropertyName(property.getNameNode())
  ) {
    const name = property.getNameNode();
    return Node.isComputedPropertyName(name)
      ? resolveStringConstant(name.getExpression())
      : undefined;
  }
  return getKeyText(property);
}

/**
 * The string an expression always evaluates to: a string literal, a `const`
 * bound to one, a member of a string enum, or a property of a `const` object
 * literal declared in this file.
 */
export function resolveStringConstant(node: Node): string | undefined {
  const value = unwrap(node);
  if (
    Node.isStringLiteral(value) ||
    Node.isNoSubstitutionTemplateLiteral(value)
  )
    return value.getLiteralText();
  if (Node.isIdentifier(value)) {
    const decls = value.getSymbol()?.getDeclarations() ?? [];
    if (decls.length !== 1 || !Node.isVariableDeclaration(decls[0])) return;
    if (!isConst(decls[0])) return;
    const init = decls[0].getInitializer();
    const literal = init && unwrap(init);
    return literal && Node.isStringLiteral(literal)
      ? literal.getLiteralText()
      : undefined;
  }
  if (!Node.isPropertyAccessExpression(value)) return undefined;
  const object = value.getExpression();
  if (!Node.isIdentifier(object)) return undefined;
  const member = value.getName();
  const decls = object.getSymbol()?.getDeclarations() ?? [];
  if (decls.length !== 1) return undefined;
  const decl = decls[0];
  if (Node.isEnumDeclaration(decl)) {
    const m = decl.getMember(member);
    const init = m?.getInitializer();
    return init && Node.isStringLiteral(init)
      ? init.getLiteralText()
      : undefined;
  }
  if (!Node.isVariableDeclaration(decl) || !isConst(decl)) return undefined;
  const init = decl.getInitializer();
  const literal = init && unwrap(init);
  if (!literal || !Node.isObjectLiteralExpression(literal)) return undefined;
  const property = literal
    .getProperties()
    .find((candidate) => getKeyText(candidate) === member);
  if (!Node.isPropertyAssignment(property)) return undefined;
  const v = unwrap(property.getInitializer()!);
  return Node.isStringLiteral(v) || Node.isNoSubstitutionTemplateLiteral(v)
    ? v.getLiteralText()
    : undefined;
}

function isConst(decl: Node): boolean {
  const list = decl.getParent();
  return (
    Node.isVariableDeclarationList(list) &&
    !!(list.getFlags() & 2) /* NodeFlags.Const */
  );
}

/**
 * Free identifiers in `node` that are declared inside a function or block
 * other than the module (so inlining the node elsewhere could not see them).
 */
export function nonModuleReferences(node: Node): string[] {
  const found = new Set<string>();
  const start = node.getPos();
  const end = node.getEnd();
  for (const id of node.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (!isReferenceIdentifier(id)) continue;
    const parent = id.getParent();
    const symbol = Node.isShorthandPropertyAssignment(parent)
      ? id
          .getProject()
          .getTypeChecker()
          .compilerObject.getShorthandAssignmentValueSymbol(parent.compilerNode)
      : id.getSymbol()?.compilerSymbol;
    for (const decl of symbol?.declarations ?? []) {
      if (decl.pos >= start && decl.end <= end) continue;
      if (decl.getSourceFile() !== node.getSourceFile().compilerNode) continue;
      let scope = decl.parent;
      while (scope && !ts.isSourceFile(scope)) {
        if (
          ts.isFunctionLike(scope) ||
          ts.isBlock(scope) ||
          ts.isClassLike(scope) ||
          ts.isModuleBlock(scope)
        ) {
          found.add(id.getText());
          break;
        }
        scope = scope.parent;
      }
    }
  }
  return [...found];
}

/** Action creators (besides `assign`) that lower to `enq` statements. */
export const ACTION_CREATORS = new Set([
  'raise',
  'sendTo',
  'sendParent',
  'forwardTo',
  'emit',
  'log',
  'cancel',
  'stopChild',
  'stop',
  'spawnChild'
]);

export interface ConstAction {
  decl: Node;
  call: CallExpression;
  callee: string;
}

/**
 * `const x = assign(...)` (or another action creator) declared at module
 * level and not exported, for an identifier used as an action.
 */
export function resolveConstAction(
  id: Node,
  xs: Map<string, string>
): ConstAction | undefined {
  const decls = id.getSymbol()?.getDeclarations() ?? [];
  if (decls.length !== 1) return undefined;
  const decl = decls[0];
  if (!Node.isVariableDeclaration(decl) || !isConst(decl)) return undefined;
  const statement = decl.getVariableStatement();
  if (
    !statement ||
    !Node.isSourceFile(statement.getParent()) ||
    statement.isExported() ||
    statement.getDeclarations().length !== 1
  )
    return undefined;
  const init = decl.getInitializer();
  const call = init && unwrap(init);
  const callee = call && xstateCallee(call, xs);
  if (!callee || !(callee === 'assign' || ACTION_CREATORS.has(callee)))
    return undefined;
  return { decl, call: call as CallExpression, callee };
}
