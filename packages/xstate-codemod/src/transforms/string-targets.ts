import {
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  SyntaxKind
} from 'ts-morph';
import type { Transform, TransformResult } from '../types.ts';
import { findMachineConfigObjects } from '../util.ts';

/**
 * Property keys whose value is a transition (or map/array of transitions) that,
 * in v6, must be an object `{ target: '...' }` rather than a bare string.
 */
const EVENT_LIKE_KEYS = new Set(['on', 'after']);
const DIRECT_TRANSITION_KEYS = new Set(['onDone', 'onError', 'always']);

/**
 * Wraps a bare string transition value into `{ target: '<str>' }`.
 * Returns true if a change was made.
 */
function wrapValue(node: Node): boolean {
  if (Node.isStringLiteral(node)) {
    const raw = node.getText(); // includes quotes
    node.replaceWithText(`{ target: ${raw} }`);
    return true;
  }
  if (Node.isArrayLiteralExpression(node)) {
    let changed = false;
    // Iterate over a snapshot; replacing elements is index-stable here since
    // we replace text in place without adding/removing elements.
    for (const el of node.getElements()) {
      if (Node.isStringLiteral(el)) {
        el.replaceWithText(`{ target: ${el.getText()} }`);
        changed = true;
      }
    }
    return changed;
  }
  return false;
}

/**
 * Given the value of an `on:` or `after:` property (an object literal mapping
 * event/delay → transition), wrap each string transition target.
 */
function wrapTransitionMap(value: Node): number {
  if (!Node.isObjectLiteralExpression(value)) {
    return 0;
  }
  let count = 0;
  for (const prop of value.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const init = prop.getInitializerOrThrow();
      if (wrapValue(init)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Recursively walk a state config object literal wrapping string transitions.
 * We recurse into `states`, `on`/`after`/`onDone`/`onError`/`always`, and
 * nested state nodes.
 */
function walkStateNode(obj: ObjectLiteralExpression, notes: string[]): number {
  let count = 0;

  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) {
      continue;
    }
    const key = getKey(prop);
    if (key === undefined) {
      continue;
    }
    const init = prop.getInitializer();
    if (!init) {
      continue;
    }

    if (EVENT_LIKE_KEYS.has(key)) {
      const n = wrapTransitionMap(init);
      count += n;
      if (n) {
        notes.push(`wrapped ${n} string transition(s) under '${key}'`);
      }
    } else if (DIRECT_TRANSITION_KEYS.has(key)) {
      if (wrapValue(init)) {
        count++;
        notes.push(`wrapped string transition under '${key}'`);
      }
    } else if (key === 'states' && Node.isObjectLiteralExpression(init)) {
      for (const stateProp of init.getProperties()) {
        if (
          Node.isPropertyAssignment(stateProp) &&
          Node.isObjectLiteralExpression(stateProp.getInitializerOrThrow())
        ) {
          count += walkStateNode(
            stateProp.getInitializerOrThrow() as ObjectLiteralExpression,
            notes
          );
        }
      }
    } else if (key === 'invoke') {
      // invoke configs carry their own onDone/onError transitions
      const invokeObjects = Node.isArrayLiteralExpression(init)
        ? init.getElements().filter(Node.isObjectLiteralExpression)
        : Node.isObjectLiteralExpression(init)
          ? [init]
          : [];
      for (const invokeObj of invokeObjects) {
        count += walkStateNode(invokeObj, notes);
      }
    }
  }

  return count;
}

function getKey(prop: PropertyAssignment): string | undefined {
  const nameNode = prop.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  if (Node.isStringLiteral(nameNode)) {
    return nameNode.getLiteralText();
  }
  if (nameNode.getKind() === SyntaxKind.NumericLiteral) {
    return nameNode.getText();
  }
  return undefined;
}

/**
 * Converts bare string transition values inside `createMachine`/`setup().
 * createMachine`/`createStateConfig` config objects into `{ target: '...' }`.
 *
 * Does NOT touch `initial:` (still a string in v6) or existing `target:`
 * values.
 */
export const stringTargets: Transform = {
  name: 'string-targets',
  description:
    "Wrap bare string transition values (on/after/onDone/onError/always) into { target: '...' } inside machine config objects. Best-effort: matches createMachine/createStateConfig by call name.",
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    let total = 0;

    for (const configObj of findMachineConfigObjects(sourceFile)) {
      total += walkStateNode(configObj, notes);
    }

    return { changed: total > 0, notes };
  }
};
