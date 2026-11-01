import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { ManualSite, Transform, TransformResult } from '../types.ts';
import { findMachineConfigObjects } from '../util.ts';

const SUFFIXED_LIFECYCLE =
  /^xstate\.(done\.state|done\.actor|error\.actor|after)\./;

const HINTS: Record<string, string> = {
  'done.state':
    "v6 raises `xstate.done.state` with `stateId`; suffixed keys never match. Use `onDone` on the parent state, or key on `'xstate.done.state'` and guard on `event.stateId`.",
  'done.actor':
    'v6 raises `xstate.done.actor` / `xstate.error.actor` with `actorId`; suffixed keys never match. Use `invoke.onDone` / `invoke.onError`, or key on the plain type and guard on `event.actorId`.',
  'error.actor':
    'v6 raises `xstate.done.actor` / `xstate.error.actor` with `actorId`; suffixed keys never match. Use `invoke.onDone` / `invoke.onError`, or key on the plain type and guard on `event.actorId`.',
  after:
    'v6 raises `xstate.after` with `delay` and `stateId`; suffixed keys never match. Use `after: { <delay>: ... }`.'
};

function getKeyText(node: Node): string | undefined {
  if (!Node.isPropertyAssignment(node)) return undefined;
  const name = node.getNameNode();
  if (Node.isStringLiteral(name)) return name.getLiteralText();
  if (Node.isIdentifier(name)) return name.getText();
  return undefined;
}

/**
 * Reports (does NOT transform) `on` keys that use v5 suffixed lifecycle event
 * types such as `xstate.done.state.<id>`. v6 raises the plain category type
 * with the id in a payload field, so these transitions never fire.
 */
export const reportSuffixedLifecycleEvents: Transform = {
  name: 'report-suffixed-lifecycle-events',
  description:
    "Detect (report only) `on` keys such as 'xstate.done.state.<id>' or 'xstate.after.<delay>.<id>' that v6 never raises.",
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    const sites: ManualSite[] = [];
    const filePath = sourceFile.getFilePath();
    const seen = new Set<Node>();

    for (const config of findMachineConfigObjects(sourceFile)) {
      for (const property of config.getDescendantsOfKind(
        SyntaxKind.PropertyAssignment
      )) {
        if (getKeyText(property) !== 'on') continue;
        const on = property.getInitializer();
        if (!on || !Node.isObjectLiteralExpression(on)) continue;
        for (const entry of on.getProperties()) {
          if (seen.has(entry)) continue;
          seen.add(entry);
          const key = getKeyText(entry);
          const match = key && SUFFIXED_LIFECYCLE.exec(key);
          if (!key || !match) continue;
          const hint = HINTS[match[1]];
          const { line, column } = sourceFile.getLineAndColumnAtPos(
            entry.getStart()
          );
          notes.push(`${filePath}:${line}:${column} — '${key}' → ${hint}`);
          sites.push({ file: filePath, line, column, api: key, hint });
        }
      }
    }

    // Never mutates the file.
    return { changed: false, notes, sites };
  }
};
