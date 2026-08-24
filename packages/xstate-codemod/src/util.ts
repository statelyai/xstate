import {
  CallExpression,
  Node,
  ObjectLiteralExpression,
  SourceFile,
  SyntaxKind
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

/** Returns the `xstate` import declaration, if present. */
function getXStateImport(sourceFile: SourceFile) {
  return sourceFile
    .getImportDeclarations()
    .find((imp) => imp.getModuleSpecifierValue() === 'xstate');
}

/**
 * Ensures a named import from `xstate` exists (adds it if missing). Only adds
 * when there is already an `xstate` import declaration in the file.
 */
export function ensureNamedImport(sourceFile: SourceFile, name: string): void {
  const imp = getXStateImport(sourceFile);
  if (!imp) {
    return;
  }
  const existing = imp
    .getNamedImports()
    .some((ni) => (ni.getAliasNode() ?? ni.getNameNode()).getText() === name);
  if (!existing) {
    imp.addNamedImport(name);
  }
}
