import { CallExpression, Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { ManualSite, Transform, TransformResult } from '../types.ts';

const SECOND_ARGUMENT_HINT =
  'v6 `createMachine` takes only a config; the second argument is ignored. Move actions, guards, actors and delays into `setup({ ... }).createMachine(...)`.';
const SIGNATURE_HINT =
  "v6 named actions and guards receive only `params`. Compute values from the transition's `args` and pass them as params: `enq(actions.name, params)` / `guards.name(params)`. A named `assign` must become a plain function returning a `{ context }` patch that the transition calls directly, since `enq(...)` ignores return values.";

const SIGNATURE_APIS: Record<string, string> = {
  actions: 'action-signature',
  guards: 'guard-signature'
};

function getKeyText(node: Node): string | undefined {
  if (!Node.isPropertyAssignment(node) && !Node.isMethodDeclaration(node)) {
    return undefined;
  }
  const name = node.getNameNode();
  if (Node.isStringLiteral(name)) return name.getLiteralText();
  if (Node.isIdentifier(name)) return name.getText();
  return undefined;
}

function getCallName(call: CallExpression): string | undefined {
  const expr = call.getExpression();
  if (Node.isIdentifier(expr)) return expr.getText();
  if (Node.isPropertyAccessExpression(expr)) return expr.getName();
  return undefined;
}

/** True for a v5 implementation signature: `({ context, event }) => ...` or `(_, params) => ...`. */
function hasV5Signature(property: Node): boolean {
  const fn = Node.isPropertyAssignment(property)
    ? property.getInitializer()
    : property;
  if (
    !fn ||
    !(
      Node.isArrowFunction(fn) ||
      Node.isFunctionExpression(fn) ||
      Node.isMethodDeclaration(fn)
    )
  ) {
    return false;
  }
  const params = fn.getParameters();
  return (
    params.length >= 2 ||
    params[0]?.getNameNode().getKind() === SyntaxKind.ObjectBindingPattern
  );
}

/**
 * Reports (does NOT transform) v5 implementation shapes that v6 ignores or
 * calls differently: a second `createMachine` argument, and named actions or
 * guards written against the v5 `({ context, event })` / `(_, params)`
 * signatures.
 */
export const reportImplementations: Transform = {
  name: 'report-implementations',
  description:
    'Detect (report only) a second `createMachine` argument and named actions/guards that use the v5 `({ context, event })` or `(_, params)` signature.',
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    const sites: ManualSite[] = [];
    const filePath = sourceFile.getFilePath();

    const report = (node: Node, api: string, hint: string) => {
      const { line, column } = sourceFile.getLineAndColumnAtPos(
        node.getStart()
      );
      notes.push(`${filePath}:${line}:${column} — '${api}' → ${hint}`);
      sites.push({ file: filePath, line, column, api, hint });
    };

    const visitImplementations = (implementations: Node | undefined) => {
      if (!implementations || !Node.isObjectLiteralExpression(implementations))
        return;
      for (const group of implementations.getProperties()) {
        const api = SIGNATURE_APIS[getKeyText(group) ?? ''];
        if (!api || !Node.isPropertyAssignment(group)) continue;
        const map = group.getInitializer();
        if (!map || !Node.isObjectLiteralExpression(map)) continue;
        for (const property of map.getProperties()) {
          if (hasV5Signature(property)) report(property, api, SIGNATURE_HINT);
        }
      }
    };

    for (const call of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    )) {
      const name = getCallName(call);
      const args = call.getArguments();
      if (name === 'setup') {
        visitImplementations(args[0]);
      } else if (name === 'createMachine' && args[1]) {
        report(args[1], 'implementations', SECOND_ARGUMENT_HINT);
        visitImplementations(args[1]);
      }
    }

    // Never mutates the file.
    return { changed: false, notes, sites };
  }
};
