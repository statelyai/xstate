import {
  CallExpression,
  Node,
  ObjectLiteralExpression,
  SourceFile,
  SyntaxKind,
  SymbolFlags
} from 'ts-morph';

/**
 * Returns the simple identifier name of the function being called, if any.
 * Handles both `createMachine(...)` and `setup(...).createMachine(...)` by
 * returning the trailing property/identifier name (e.g. `createMachine`).
 */
function getCallName(call: CallExpression): string | undefined {
  const expr = call.getExpression();
  if (Node.isIdentifier(expr)) {
    return expr.getText();
  }
  if (Node.isPropertyAccessExpression(expr)) {
    return expr.getNameNode().getText();
  }
  return undefined;
}

/**
 * Finds the config object literals passed as the first argument to
 * `createMachine(...)` or `createStateConfig(...)` (including the
 * `setup(...).createMachine(...)` form).
 *
 * This is a best-effort match by call-expression name, not by resolving the
 * actual import — that is sufficient for a migration codemod and avoids fragile
 * type resolution.
 */
export function findMachineConfigObjects(
  sourceFile: SourceFile,
  callNames: readonly string[] = ['createMachine', 'createStateConfig']
): ObjectLiteralExpression[] {
  const result: ObjectLiteralExpression[] = [];
  for (const call of sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression
  )) {
    const name = getCallName(call);
    if (!name || !callNames.includes(name)) {
      continue;
    }
    const firstArg = call.getArguments()[0];
    if (firstArg && Node.isObjectLiteralExpression(firstArg)) {
      result.push(firstArg);
    }
  }
  return result;
}

/** Finds or adds a runtime helper import and returns its binding at the use site. */
export function ensureNamedImport(
  sourceFile: SourceFile,
  name: string,
  location: Node = sourceFile
): string | undefined {
  const imports = sourceFile
    .getImportDeclarations()
    .filter((imp) => imp.getModuleSpecifierValue() === 'xstate');
  if (!imports.length) return undefined;

  const visible = location.getSymbolsInScope(SymbolFlags.Value);
  for (const imp of imports) {
    if (imp.isTypeOnly()) continue;
    for (const spec of imp.getNamedImports()) {
      if (spec.isTypeOnly() || spec.getName() !== name) continue;
      const local = (spec.getAliasNode() ?? spec.getNameNode()).getText();
      if (
        visible
          .find((symbol) => symbol.getName() === local)
          ?.getDeclarations()
          .includes(spec)
      ) {
        return local;
      }
    }
  }

  // Reserve every identifier, including nested bindings, so the new import is
  // usable throughout the file without shadowing an existing local value.
  const identifiers = new Set(
    sourceFile
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .filter((node) => {
        const parent = node.getParent();
        return !(
          (Node.isPropertyAssignment(parent) ||
            Node.isPropertySignature(parent)) &&
          parent.getNameNode() === node
        );
      })
      .map((node) => node.getText())
  );
  let local = name;
  let suffix = 1;
  while (identifiers.has(local)) local = `${name}${suffix++}`;
  const specifier = { name, ...(local === name ? {} : { alias: local }) };
  const target = imports.find(
    (imp) => !imp.isTypeOnly() && !imp.getNamespaceImport()
  );
  if (target) target.addNamedImport(specifier);
  else
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'xstate',
      namedImports: [specifier]
    });
  return local;
}
