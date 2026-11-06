import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { ManualSite, Transform, TransformResult } from '../types.ts';

const TRANSITION_HINT =
  'v6 emits only `@xstate.actor` and `@xstate.transition`; read the event, snapshot, executed `actions` and `microsteps` from `@xstate.transition`.';

const HINTS: Record<string, string> = {
  '@xstate.event': TRANSITION_HINT,
  '@xstate.snapshot': TRANSITION_HINT,
  '@xstate.action': TRANSITION_HINT,
  '@xstate.microstep': TRANSITION_HINT,
  '@xstate.deadletter':
    'v6 has no dead-letter inspection event; observe undelivered events with the `onRejectedEvent` option of `createActor` or `system.onRejectedEvent(listener)`.'
};

/**
 * Reports (does NOT transform) string literals naming v5 inspection event
 * types. Inspection code often types events loosely or lives in plain
 * JavaScript, where comparing against a removed type compiles and never
 * matches. Scans every file, with or without an `xstate` import.
 */
export const reportInspectionEvents: Transform = {
  name: 'report-inspection-events',
  description:
    "Detect (report only) v5 inspection event types such as '@xstate.snapshot', which v6 never emits.",
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    const sites: ManualSite[] = [];
    const filePath = sourceFile.getFilePath();

    const literals = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
      ...sourceFile.getDescendantsOfKind(
        SyntaxKind.NoSubstitutionTemplateLiteral
      )
    ].sort((a, b) => a.getStart() - b.getStart());

    for (const literal of literals) {
      if (Node.isImportDeclaration(literal.getParent())) continue;
      const api = literal.getLiteralText();
      const hint = HINTS[api];
      if (!hint) continue;
      const { line, column } = sourceFile.getLineAndColumnAtPos(
        literal.getStart()
      );
      notes.push(`${filePath}:${line}:${column} — '${api}' → ${hint}`);
      sites.push({ file: filePath, line, column, api, hint });
    }

    // Never mutates the file.
    return { changed: false, notes, sites };
  }
};
