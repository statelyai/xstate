import {
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  SyntaxKind
} from 'ts-morph';
import type { ManualSite, Transform, TransformResult } from '../types.ts';
import { findMachineConfigObjects } from '../util.ts';

const SUFFIXED_LIFECYCLE =
  /^xstate\.(done\.state|done\.actor|error\.actor|snapshot|after)\.(.+)$/;

type Category =
  | 'done.state'
  | 'done.actor'
  | 'error.actor'
  | 'snapshot'
  | 'after';

// v6 category type and the payload field that carries the v5 suffix.
const REWRITES: Partial<Record<Category, { type: string; field: string }>> = {
  'done.actor': { type: 'xstate.done.actor', field: 'actorId' },
  'error.actor': { type: 'xstate.error.actor', field: 'actorId' },
  snapshot: { type: 'xstate.snapshot.actor', field: 'actorId' },
  'done.state': { type: 'xstate.done.state', field: 'stateId' }
};

const AFTER_HINT =
  'v6 raises `xstate.after` with `delay` and `stateId`; suffixed keys never match. Use `after: { <delay>: ... }` on the state.';

function keyHint(category: Category, suffix: string, reason: string): string {
  const rewrite = REWRITES[category];
  if (!rewrite) return AFTER_HINT;
  return `${reason} Key on '${rewrite.type}' and select the payload with \`matches: { ${rewrite.field}: '${suffix}' }\`.`;
}

const LITERAL_HINT =
  'v6 lifecycle event types carry the id in a payload field (`actorId`, `stateId`, `delay`), so this string never equals `event.type`. Compare the category type and the payload field instead.';

/** Parses a suffixed lifecycle type; wildcards and `xstate.snapshot.actor` are v6-valid. */
function parseSuffixed(
  text: string
): { category: Category; suffix: string } | undefined {
  const match = SUFFIXED_LIFECYCLE.exec(text);
  if (!match) return undefined;
  const [, category, suffix] = match as unknown as [string, Category, string];
  if (suffix === '*' || suffix.endsWith('.*')) return undefined;
  if (category === 'snapshot' && suffix === 'actor') return undefined;
  return { category, suffix };
}

function getKeyText(node: Node): string | undefined {
  if (!Node.isPropertyAssignment(node)) return undefined;
  const name = node.getNameNode();
  if (Node.isStringLiteral(name)) return name.getLiteralText();
  if (Node.isIdentifier(name)) return name.getText();
  return undefined;
}

/** v5 `done.state` suffixes are state ids, which used the `(machine)` placeholder. */
function v6StateId(suffix: string): string {
  return suffix.startsWith('(machine).')
    ? suffix.slice('(machine).'.length)
    : suffix;
}

/**
 * Builds the v6 transition for a suffixed key, or explains why it cannot.
 * Object literals get `matches` prepended; functions move under `to`.
 */
function rewriteInitializer(
  entry: PropertyAssignment,
  field: string,
  value: string
): string {
  const init = entry.getInitializerOrThrow();
  const matches = `matches: { ${field}: ${JSON.stringify(value).replace(/"/g, "'")} }`;
  if (Node.isObjectLiteralExpression(init)) {
    if (init.getProperty('matches')) return '';
    const props = init.getProperties().map((p) => p.getText());
    return `{ ${[matches, ...props].join(', ')} }`;
  }
  if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
    return `{ ${matches}, to: ${init.getText()} }`;
  }
  return '';
}

/**
 * Rewrites `on` keys that use v5 suffixed lifecycle event types, such as
 * `'xstate.done.actor.job'`, to the v6 category type with `matches`.
 * Reports what it cannot rewrite: `xstate.after.<delay>.<id>` keys, keys
 * whose category type is already present or used twice in the same `on`,
 * and suffixed type strings outside `on` keys (for example
 * `event.type === 'xstate.done.actor.job'`).
 */
export const suffixedLifecycleEvents: Transform = {
  name: 'suffixed-lifecycle-events',
  description:
    "Rewrite `on` keys such as 'xstate.done.actor.<id>' to the v6 category type with `matches`; report suffixed types it cannot rewrite.",
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    const sites: ManualSite[] = [];
    const filePath = sourceFile.getFilePath();
    const handled = new Set<Node>();
    let changed = false;

    const report = (node: Node, api: string, hint: string) => {
      const { line, column } = sourceFile.getLineAndColumnAtPos(
        node.getStart()
      );
      notes.push(`${filePath}:${line}:${column} — '${api}' → ${hint}`);
      sites.push({ file: filePath, line, column, api, hint });
    };

    const onObjects: ObjectLiteralExpression[] = [];
    for (const config of findMachineConfigObjects(sourceFile)) {
      for (const property of config.getDescendantsOfKind(
        SyntaxKind.PropertyAssignment
      )) {
        if (getKeyText(property) !== 'on') continue;
        const on = property.getInitializer();
        if (
          on &&
          Node.isObjectLiteralExpression(on) &&
          !onObjects.includes(on)
        ) {
          onObjects.push(on);
        }
      }
    }

    for (const on of onObjects) {
      const entries = on.getProperties().flatMap((entry) => {
        const key = getKeyText(entry);
        const parsed = key ? parseSuffixed(key) : undefined;
        return parsed && Node.isPropertyAssignment(entry)
          ? [{ entry, key: key!, ...parsed }]
          : [];
      });
      const existingKeys = new Set(
        on.getProperties().map(getKeyText).filter(Boolean) as string[]
      );
      for (const item of entries) {
        handled.add(item.entry.getNameNode());
        const rewrite = REWRITES[item.category];
        if (!rewrite) {
          report(item.entry, item.key, AFTER_HINT);
          continue;
        }
        const sameCategory = entries.filter(
          (other) => REWRITES[other.category]?.type === rewrite.type
        );
        if (existingKeys.has(rewrite.type) || sameCategory.length > 1) {
          report(
            item.entry,
            item.key,
            keyHint(
              item.category,
              item.suffix,
              `\`on\` already handles '${rewrite.type}' or several suffixed keys share it; merge them into one transition by hand.`
            )
          );
          continue;
        }
        const value =
          item.category === 'done.state' ? v6StateId(item.suffix) : item.suffix;
        const replacement = rewriteInitializer(
          item.entry,
          rewrite.field,
          value
        );
        if (!replacement) {
          report(
            item.entry,
            item.key,
            keyHint(
              item.category,
              item.suffix,
              'The transition is not an object or function literal, or already has `matches`.'
            )
          );
          continue;
        }
        item.entry.replaceWithText(`'${rewrite.type}': ${replacement}`);
        changed = true;
      }
    }

    const importsXState = sourceFile
      .getImportDeclarations()
      .some((d) => /^xstate(\/|$)/.test(d.getModuleSpecifierValue()));
    if (importsXState) {
      for (const literal of [
        ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
        ...sourceFile.getDescendantsOfKind(
          SyntaxKind.NoSubstitutionTemplateLiteral
        )
      ]) {
        if (literal.wasForgotten() || handled.has(literal)) continue;
        if (Node.isImportDeclaration(literal.getParent())) continue;
        const text = literal.getLiteralText();
        if (parseSuffixed(text)) report(literal, text, LITERAL_HINT);
      }
    }

    return { changed, notes, sites };
  }
};
