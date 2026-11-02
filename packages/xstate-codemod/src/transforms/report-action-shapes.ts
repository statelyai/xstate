import { Node, SourceFile } from 'ts-morph';
import type { ManualSite, Transform, TransformResult } from '../types.ts';
import { findMachineConfigObjects } from '../util.ts';
import { derefConfig, isIndirect } from './lower-actions/analysis.ts';

const ENTRY_EXIT_HINT =
  'v6 `entry`/`exit` is a single function `(args, enq) => { ... }`; call named actions with `enq(actions.name, params)`.';
const TRANSITION_ACTIONS_HINT =
  'transition `actions` was removed; use an inline transition function `(args, enq) => { ... }` and queue effects on `enq`; call named actions with `enq(actions.name, params)`.';
const TRANSITION_GUARD_HINT =
  'transition `guard` was removed; return `{ target }` from an inline transition function when the condition holds, or `undefined` to reject the event; named guards are plain predicates called as `guards.name(params)`.';

const TRANSITION_ARRAY_HINT =
  'v6 takes one transition function; combine the candidates into an if-chain: `(args, enq) => { if (cond) return { target }; return { target: other }; }`.';

const INDIRECT_CONFIG_HINT =
  'v6 rejects v5 transition objects, `actions`/`guard` and action lists; this value is not an inline literal or an in-file `const`, so the codemod cannot see into it. Inline it or migrate it by hand.';

function getKeyText(node: Node): string | undefined {
  if (!Node.isPropertyAssignment(node)) return undefined;
  const name = node.getNameNode();
  if (Node.isStringLiteral(name)) return name.getLiteralText();
  if (Node.isIdentifier(name)) return name.getText();
  return undefined;
}

function getProperty(object: Node, key: string): Node | undefined {
  if (!Node.isObjectLiteralExpression(object)) return undefined;
  const property = object
    .getProperties()
    .find((candidate) => getKeyText(candidate) === key);
  return Node.isPropertyAssignment(property)
    ? property.getInitializer()
    : undefined;
}

/**
 * Reports (does NOT transform) v5 action shapes that v6 rejects: non-function
 * `entry` / `exit` values, transition arrays, and `actions`, `guard` or `cond`
 * on transition objects.
 */
export const reportActionShapes: Transform = {
  name: 'report-action-shapes',
  description:
    'Detect (report only) non-function `entry`/`exit` values, transition arrays and transition `actions`/`guard`/`cond`, which v6 rejects.',
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    const sites: ManualSite[] = [];
    const filePath = sourceFile.getFilePath();
    const seen = new Set<Node>();

    const report = (node: Node, api: string, hint: string) => {
      if (seen.has(node)) return;
      seen.add(node);
      const { line, column } = sourceFile.getLineAndColumnAtPos(
        node.getStart()
      );
      notes.push(`${filePath}:${line}:${column} — '${api}' → ${hint}`);
      sites.push({ file: filePath, line, column, api, hint });
    };

    /** The literal behind a reference, or undefined (reported) when unknown. */
    const look = (node: Node | undefined): Node | undefined => {
      if (!node || !isIndirect(node)) return node;
      const target = derefConfig(node);
      if (!target) {
        report(node, 'indirect-config', INDIRECT_CONFIG_HINT);
        return undefined;
      }
      return target.node;
    };

    const visitTransition = (node: Node | undefined) => {
      const value = look(node);
      if (!value) return;
      if (Node.isArrayLiteralExpression(value)) {
        report(value, 'transition-array', TRANSITION_ARRAY_HINT);
        value.getElements().forEach(visitTransition);
        return;
      }
      if (!Node.isObjectLiteralExpression(value)) return;
      for (const property of value.getProperties()) {
        const key = getKeyText(property);
        if (key === 'actions') {
          report(property, 'actions', TRANSITION_ACTIONS_HINT);
        } else if (key === 'guard' || key === 'cond') {
          report(property, key, TRANSITION_GUARD_HINT);
        }
      }
    };

    const visitTransitionMap = (node: Node | undefined) => {
      const value = look(node);
      if (!value || !Node.isObjectLiteralExpression(value)) return;
      for (const property of value.getProperties()) {
        if (Node.isPropertyAssignment(property)) {
          visitTransition(property.getInitializer());
        } else if (Node.isSpreadAssignment(property)) {
          visitTransitionMap(property);
        }
      }
    };

    const visitStates = (node: Node | undefined) => {
      const value = look(node);
      if (!value || !Node.isObjectLiteralExpression(value)) return;
      for (const child of value.getProperties()) {
        if (Node.isPropertyAssignment(child)) {
          visitState(child.getInitializer());
        } else if (Node.isShorthandPropertyAssignment(child)) {
          visitState(child);
        } else if (Node.isSpreadAssignment(child)) {
          visitStates(child);
        }
      }
    };

    const visitState = (node: Node | undefined) => {
      const state = look(node);
      if (!state || !Node.isObjectLiteralExpression(state)) return;
      for (const property of state.getProperties()) {
        if (Node.isSpreadAssignment(property)) {
          visitState(property);
          continue;
        }
        const key = getKeyText(property);
        if (!key || !Node.isPropertyAssignment(property)) continue;
        const raw = property.getInitializer();
        const value =
          raw && ['entry', 'exit', 'invoke'].includes(key) ? look(raw) : raw;
        switch (key) {
          case 'entry':
          case 'exit':
            if (
              value &&
              !Node.isArrowFunction(value) &&
              !Node.isFunctionExpression(value) &&
              !Node.isFunctionDeclaration(value)
            ) {
              report(property, key, ENTRY_EXIT_HINT);
            }
            break;
          case 'on':
          case 'after':
            visitTransitionMap(value);
            break;
          case 'always':
          case 'onDone':
          case 'onError':
          case 'onSnapshot':
            visitTransition(value);
            break;
          case 'initial':
            if (value && Node.isObjectLiteralExpression(value)) {
              visitTransition(value);
            }
            break;
          case 'invoke': {
            const invokes =
              value && Node.isArrayLiteralExpression(value)
                ? value.getElements()
                : [value];
            for (const element of invokes) {
              const invoke = look(element);
              for (const event of ['onDone', 'onError', 'onSnapshot']) {
                visitTransition(invoke && getProperty(invoke, event));
              }
            }
            break;
          }
          case 'states':
            visitStates(value);
            break;
        }
      }
    };

    for (const config of findMachineConfigObjects(sourceFile)) {
      visitState(config);
    }

    // Never mutates the file.
    return { changed: false, notes, sites };
  }
};
