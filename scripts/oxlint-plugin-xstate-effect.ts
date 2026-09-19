// Lint rules for @xstate/effect usage, on the typed @oxlint/plugins API.
//
// `no-inline-effect` flags an Effect created inside an inline enqueue callback
// or passed inline to `enq.spawn(...)`. XState only awaits returned promises,
// so an Effect returned from an inline action is created and discarded, and
// inline Effect logic is invisible to `RequirementsFrom`. Declare Effect
// actions with `setupEffect({ actions })` and spawned Effect logic with
// `actors` instead.
//
// The enqueue object is matched by name (`enq` or `enqueue`), the two names
// the v6 transition signature is written with in this repository and in the
// docs. A differently named parameter is not matched.
//
// Limitation: an Effect is recognized only by its root identifier `Effect`,
// so `enq(() => Effect.log('x'))` is reported while an Effect produced by a
// helper (`enq(() => makeEffect())`), by a namespace import under another
// name, or by a `Stream`/`Layer` root is not. Widening this needs type
// information, which this syntactic rule does not have.
import { definePlugin, defineRule } from '@oxlint/plugins';
import type { ESTree } from '@oxlint/plugins';

const ENQUEUE_NAMES = new Set(['enq', 'enqueue']);

const EFFECT_LOGIC_CONSTRUCTORS = new Set([
  'fromEffect',
  'fromEffectStream',
  'fromEffectEventStream'
]);

// ESTree.Function covers FunctionExpression and FunctionDeclaration.
type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

const isNode = (value: unknown): value is ESTree.Node =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof value.type === 'string';

const rootIdentifier = (node: ESTree.Node): string | undefined => {
  let current: ESTree.Node = node;
  for (;;) {
    if (current.type === 'CallExpression') {
      current = current.callee;
    } else if (current.type === 'MemberExpression') {
      current = current.object;
    } else if (current.type === 'Identifier') {
      return current.name;
    } else {
      return undefined;
    }
  }
};

const returnedExpressions = (fn: FunctionNode): ESTree.Node[] => {
  if (fn.body === null) {
    return [];
  }
  if (fn.body.type !== 'BlockStatement') {
    return [fn.body];
  }
  const found: ESTree.Node[] = [];
  const visit = (node: ESTree.Node) => {
    if (node.type === 'ReturnStatement') {
      if (node.argument) {
        found.push(node.argument);
      }
      return;
    }
    if (
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'FunctionDeclaration'
    ) {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent') {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isNode(item)) {
            visit(item);
          }
        }
      } else if (isNode(value)) {
        visit(value);
      }
    }
  };
  visit(fn.body);
  return found;
};

const isPromiseResolve = (node: ESTree.CallExpression): boolean =>
  node.callee.type === 'MemberExpression' &&
  node.callee.object.type === 'Identifier' &&
  node.callee.object.name === 'Promise' &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'resolve';

// An `Effect.*` call, or `Promise.resolve(<Effect call>)`. Core observes a
// returned promise for rejection only, so a promise-wrapped Effect is
// discarded the same way a bare one is.
const isEffectExpression = (node: ESTree.Node): boolean => {
  if (node.type !== 'CallExpression') {
    return false;
  }
  if (isPromiseResolve(node)) {
    const [argument] = node.arguments;
    return argument !== undefined && isEffectExpression(argument);
  }
  return rootIdentifier(node) === 'Effect';
};

const isInlineEffectLogic = (node: ESTree.Node): boolean =>
  node.type === 'CallExpression' &&
  node.callee.type === 'Identifier' &&
  EFFECT_LOGIC_CONSTRUCTORS.has(node.callee.name);

const isFunctionNode = (node: ESTree.Node): node is FunctionNode =>
  node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression';

const noInlineEffect = defineRule({
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;

        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          ENQUEUE_NAMES.has(callee.object.name) &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'spawn'
        ) {
          const [logic] = node.arguments;
          if (logic !== undefined && isInlineEffectLogic(logic)) {
            context.report({ messageId: 'inlineSpawn', node: logic });
          }
          return;
        }

        if (callee.type !== 'Identifier' || !ENQUEUE_NAMES.has(callee.name)) {
          return;
        }
        const [action] = node.arguments;
        if (action === undefined || !isFunctionNode(action)) {
          return;
        }
        for (const expression of returnedExpressions(action)) {
          if (isEffectExpression(expression)) {
            context.report({ messageId: 'inlineAction', node: expression });
          }
        }
      }
    };
  },
  meta: {
    docs: {
      description:
        'Disallow Effects in inline enqueue callbacks and inline Effect logic in enq.spawn; declare them in setupEffect({ actions }) or actors.'
    },
    messages: {
      inlineAction:
        'An Effect returned from an inline action is discarded. Declare it in setupEffect({ actions }) and run it with enq(args.actions.name, args).',
      inlineSpawn:
        'Inline Effect logic passed to enq.spawn is invisible to RequirementsFrom and rejected at runtime. Declare it in actors and spawn args.actors.name.'
    },
    type: 'problem'
  }
});

export default definePlugin({
  meta: { name: 'xstate-effect' },
  rules: { 'no-inline-effect': noInlineEffect }
});
