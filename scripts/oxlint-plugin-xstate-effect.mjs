// Lint rules for @xstate/effect usage.
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

const ENQUEUE_NAMES = new Set(['enq', 'enqueue']);

const EFFECT_LOGIC_CONSTRUCTORS = new Set([
  'fromEffect',
  'fromEffectStream',
  'fromEffectEventStream'
]);

function rootIdentifier(node) {
  let current = node;
  while (current) {
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
  return undefined;
}

function returnedExpressions(fn) {
  if (fn.body.type !== 'BlockStatement') {
    return [fn.body];
  }
  const found = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }
    if (node.type === 'ReturnStatement' && node.argument) {
      found.push(node.argument);
      return;
    }
    if (
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'FunctionDeclaration'
    ) {
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent') {
        continue;
      }
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value.type === 'string') {
        visit(value);
      }
    }
  };
  visit(fn.body);
  return found;
}

function isEffectExpression(node) {
  return node.type === 'CallExpression' && rootIdentifier(node) === 'Effect';
}

function isInlineEffectLogic(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    EFFECT_LOGIC_CONSTRUCTORS.has(node.callee.name)
  );
}

const noInlineEffect = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Effects in inline enqueue callbacks and inline Effect logic in enq.spawn; declare them in setupEffect({ actions }) or actors.'
    },
    messages: {
      inlineAction:
        'An Effect returned from an inline action is discarded. Declare it in setupEffect({ actions }) and run it with enq(args.actions.name, args).',
      inlineSpawn:
        'Inline Effect logic passed to enq.spawn is invisible to RequirementsFrom and rejected at runtime. Declare it in actors and spawn args.actors.name.'
    }
  },
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
          if (logic && isInlineEffectLogic(logic)) {
            context.report({ node: logic, messageId: 'inlineSpawn' });
          }
          return;
        }

        if (callee.type !== 'Identifier' || !ENQUEUE_NAMES.has(callee.name)) {
          return;
        }
        const [action] = node.arguments;
        if (
          !action ||
          (action.type !== 'ArrowFunctionExpression' &&
            action.type !== 'FunctionExpression')
        ) {
          return;
        }
        for (const expression of returnedExpressions(action)) {
          if (isEffectExpression(expression)) {
            context.report({ node: expression, messageId: 'inlineAction' });
          }
        }
      }
    };
  }
};

export default {
  meta: { name: 'xstate-effect' },
  rules: { 'no-inline-effect': noInlineEffect }
};
