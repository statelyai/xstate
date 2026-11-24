import { CallExpression, Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { ManualSite, Transform, TransformResult } from '../types.ts';

const SECOND_ARGUMENT_HINT =
  'v6 `createMachine` takes only a config; the second argument is ignored. Move actions, guards, actors and delays into `setup({ ... }).createMachine(...)`.';

function getCallName(call: CallExpression): string | undefined {
  const expr = call.getExpression();
  if (Node.isIdentifier(expr)) return expr.getText();
  if (Node.isPropertyAccessExpression(expr)) return expr.getName();
  return undefined;
}

/**
 * Reports (does NOT transform) a second `createMachine` argument, which v6
 * ignores. `lower-actions` moves object-literal ones into the config.
 */
export const reportImplementations: Transform = {
  name: 'report-implementations',
  description:
    'Detect (report only) a second `createMachine` argument, which v6 ignores.',
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

    for (const call of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    )) {
      const name = getCallName(call);
      const args = call.getArguments();
      if (name === 'createMachine' && args[1]) {
        report(args[1], 'implementations', SECOND_ARGUMENT_HINT);
      }
    }

    // Never mutates the file.
    return { changed: false, notes, sites };
  }
};
