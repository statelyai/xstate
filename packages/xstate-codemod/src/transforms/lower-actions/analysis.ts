import {
  CallExpression,
  Node,
  ObjectLiteralExpression,
  SourceFile,
  SyntaxKind
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

export type ImplKind = 'fn' | 'assign' | 'other';
export interface ImplDef {
  kind: ImplKind;
  /** The property (assignment or method) declaring the implementation. */
  property: Node;
  /** For `assign(...)`: the argument. */
  assignArg?: Node;
}

function classify(property: Node, xs: Map<string, string>): ImplDef {
  if (Node.isMethodDeclaration(property)) return { kind: 'fn', property };
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
      const key = getKeyText(property);
      if (key === undefined || impls[group].has(key)) continue;
      impls[group].set(key, classify(property, xs));
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
  const decls = id.getSymbol()?.getDeclarations() ?? [];
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
