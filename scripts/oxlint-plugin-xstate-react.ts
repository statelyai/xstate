// Lint rules for XState usage in React components, on the typed
// @oxlint/plugins API.
//
// `no-machine-in-component` flags `createMachine(...)`,
// `setup(...).createMachine(...)` (any `.createMachine(...)` member call) and
// `createStore(...)` calls lexically inside a component or hook body: a
// function named with an uppercase first letter or `use`. `useActorRef`,
// `useActor` and `useMachine` keep the first machine they receive, so a machine
// created on every render is discarded on every render after the first.
// Calls inside a `useMemo` or `useState` initializer callback are allowed.
//
// The name comes from the function declaration or the variable it is assigned
// to, looking through `memo(...)`, `forwardRef(...)`, `React.memo(...)` and
// `React.forwardRef(...)` wrappers: `const Foo = memo(() => ...)` is `Foo`.
import { definePlugin, defineRule } from '@oxlint/plugins';
import type { ESTree } from '@oxlint/plugins';

const FACTORY_NAMES = new Set(['createMachine', 'createStore']);
const INITIALIZER_HOOKS = new Set(['useMemo', 'useState']);
const COMPONENT_WRAPPERS = new Set(['memo', 'forwardRef']);

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

const isFunctionNode = (node: ESTree.Node): node is FunctionNode =>
  node.type === 'ArrowFunctionExpression' ||
  node.type === 'FunctionExpression' ||
  node.type === 'FunctionDeclaration';

const isFactoryCall = (node: ESTree.CallExpression): boolean => {
  const { callee } = node;
  if (callee.type === 'Identifier') {
    return FACTORY_NAMES.has(callee.name);
  }
  return (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'createMachine'
  );
};

const calleeName = (node: ESTree.CallExpression): string | undefined => {
  const { callee } = node;
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return undefined;
};

// A `useMemo(() => ...)` or `useState(() => ...)` initializer callback.
const isInitializerCallback = (fn: FunctionNode): boolean => {
  const { parent } = fn;
  if (parent.type !== 'CallExpression' || parent.arguments[0] !== fn) {
    return false;
  }
  const name = calleeName(parent);
  return name !== undefined && INITIALIZER_HOOKS.has(name);
};

const functionName = (fn: FunctionNode): string | undefined => {
  if (fn.type !== 'ArrowFunctionExpression' && fn.id) {
    return fn.id.name;
  }
  // Look through component wrappers: `const Foo = memo(() => ...)`.
  let node: ESTree.Node = fn;
  let { parent } = fn;
  while (
    parent.type === 'CallExpression' &&
    parent.arguments[0] === node &&
    COMPONENT_WRAPPERS.has(calleeName(parent) ?? '')
  ) {
    node = parent;
    parent = parent.parent;
  }
  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return parent.id.name;
  }
  return undefined;
};

const isComponentOrHookName = (name: string): boolean =>
  /^[A-Z]/.test(name) || /^use(?:[A-Z0-9_]|$)/.test(name);

const noMachineInComponent = defineRule({
  create(context) {
    return {
      CallExpression(node) {
        if (!isFactoryCall(node)) {
          return;
        }
        for (
          let current: ESTree.Node | null = node.parent;
          current !== null;
          current = current.parent
        ) {
          if (!isFunctionNode(current)) {
            continue;
          }
          if (isInitializerCallback(current)) {
            return;
          }
          const name = functionName(current);
          if (name !== undefined && isComponentOrHookName(name)) {
            context.report({ messageId: 'inComponent', node });
            return;
          }
        }
      }
    };
  },
  meta: {
    docs: {
      description:
        'Disallow creating machines and stores in component or hook bodies; create them at module scope or memoize them.'
    },
    messages: {
      inComponent:
        'Create machines at module scope, or memoize with useMemo; useActorRef keeps the first machine it receives.'
    },
    type: 'suggestion'
  }
});

export default definePlugin({
  meta: { name: 'xstate' },
  rules: { 'no-machine-in-component': noMachineInComponent }
});
