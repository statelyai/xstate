import {
  CallExpression,
  Node,
  ObjectLiteralExpression,
  SourceFile,
  StringLiteral,
  SyntaxKind
} from 'ts-morph';
import type { Transform, TransformResult } from '../types.ts';
import { findMachineConfigObjects } from '../util.ts';

/** Keys whose string values (or string array elements) are state targets. */
const TARGET_KEYS = new Set([
  'target',
  'initial',
  'on',
  'after',
  'always',
  'onDone',
  'onError'
]);

/** Calls whose first argument is a state value or `#id` reference. */
const MATCH_CALLS = new Set(['matches', 'stateIn']);

function getPropertyName(node: Node): string | undefined {
  if (Node.isPropertyAssignment(node)) {
    const name = node.getNameNode();
    if (Node.isIdentifier(name) || Node.isStringLiteral(name)) {
      return Node.isStringLiteral(name)
        ? name.getLiteralText()
        : name.getText();
    }
  }
  return undefined;
}

function getStringProperty(
  object: ObjectLiteralExpression,
  name: string
): string | undefined {
  const property = object.getProperty(name);
  if (!property || !Node.isPropertyAssignment(property)) return undefined;
  const initializer = property.getInitializer();
  return initializer &&
    (Node.isStringLiteral(initializer) ||
      Node.isNoSubstitutionTemplateLiteral(initializer))
    ? initializer.getLiteralText()
    : undefined;
}

/**
 * Collects the state ids that the machine configs in this file statically
 * declare: explicit `id`s and implicit ids (the path from the root, prefixed
 * by the machine id when one is set).
 */
function collectKnownIds(sourceFile: SourceFile): Set<string> {
  const ids = new Set<string>();

  function walk(config: ObjectLiteralExpression, implicitId: string): void {
    const explicitId = getStringProperty(config, 'id');
    ids.add(explicitId ?? implicitId);
    const states = config.getProperty('states');
    if (!states || !Node.isPropertyAssignment(states)) return;
    const statesObject = states.getInitializer();
    if (!statesObject || !Node.isObjectLiteralExpression(statesObject)) return;
    for (const state of statesObject.getProperties()) {
      const key = getPropertyName(state);
      if (key === undefined || !Node.isPropertyAssignment(state)) continue;
      const stateConfig = state.getInitializer();
      if (!stateConfig || !Node.isObjectLiteralExpression(stateConfig)) {
        continue;
      }
      walk(stateConfig, implicitId ? `${implicitId}.${key}` : key);
    }
  }

  for (const config of findMachineConfigObjects(sourceFile, [
    'createMachine'
  ])) {
    walk(config, getStringProperty(config, 'id') ?? '');
  }
  // Explicit ids declared elsewhere, such as in `createStateConfig(...)` or
  // `setup({ states })`, are still whole ids.
  for (const property of sourceFile.getDescendantsOfKind(
    SyntaxKind.PropertyAssignment
  )) {
    if (getPropertyName(property) !== 'id') continue;
    const initializer = property.getInitializer();
    if (initializer && Node.isStringLiteral(initializer)) {
      ids.add(initializer.getLiteralText());
    }
  }
  return ids;
}

function isMatchArgument(literal: StringLiteral): boolean {
  const call = literal.getParent();
  if (!call || !Node.isCallExpression(call)) return false;
  if ((call as CallExpression).getArguments()[0] !== literal) return false;
  const expression = (call as CallExpression).getExpression();
  const name = Node.isIdentifier(expression)
    ? expression.getText()
    : Node.isPropertyAccessExpression(expression)
      ? expression.getName()
      : undefined;
  return !!name && MATCH_CALLS.has(name);
}

function isTargetValue(literal: StringLiteral): boolean {
  let node: Node = literal;
  let parent = node.getParent();
  if (parent && Node.isArrayLiteralExpression(parent)) {
    node = parent;
    parent = node.getParent();
  }
  if (!parent || !Node.isPropertyAssignment(parent)) return false;
  const name = getPropertyName(parent);
  if (name && TARGET_KEYS.has(name)) return true;
  // A bare string transition inside `on: { EVENT: '#a.b' }` or
  // `after: { 1000: '#a.b' }`.
  const container = parent.getParent();
  const owner = container?.getParent();
  const ownerName = owner ? getPropertyName(owner) : undefined;
  return ownerName === 'on' || ownerName === 'after';
}

/**
 * Reports (does NOT transform) `#a.b` targets and `matches('#a.b')`/
 * `stateIn('#a.b')` references that the codemod cannot verify as whole state
 * ids. In v6, the text after `#` is an exact id and is never split into an
 * id followed by a path.
 */
export const reportIdPathTargets: Transform = {
  name: 'report-id-path-targets',
  description:
    "Detect (report only) '#id.path' targets and matches('#id.path') references that may combine an id with a relative path, which v6 no longer resolves.",
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    let knownIds: Set<string> | undefined;
    const filePath = sourceFile.getFilePath();

    for (const literal of sourceFile.getDescendantsOfKind(
      SyntaxKind.StringLiteral
    )) {
      const text = literal.getLiteralText();
      if (!text.startsWith('#') || !text.includes('.')) continue;
      if (!isTargetValue(literal) && !isMatchArgument(literal)) continue;
      knownIds ??= collectKnownIds(sourceFile);
      if (knownIds.has(text.slice(1))) continue;
      const { line, column } = sourceFile.getLineAndColumnAtPos(
        literal.getStart()
      );
      notes.push(
        `${filePath}:${line}:${column} — '${text}' → '#…' is an exact state id in v6 and is never split into an id and a path; use the target state's own id (its explicit \`id\` or its full implicit id)`
      );
    }

    // Never mutates the file.
    return { changed: false, notes };
  }
};
