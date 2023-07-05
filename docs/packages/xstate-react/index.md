# @xstate/react

The [@xstate/react package](https://github.com/statelyai/xstate/tree/main/packages/xstate-react) contains utilities for using [XState](https://github.com/statelyai/xstate) with [React](https://github.com/facebook/react/).

[[toc]]

## Quick Start

1. Install `xstate` and `@xstate/react`:

```bash
npm i xstate @xstate/react
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/react/dist/xstate-react.umd.min.js"></script>
```

By using the global variable `XStateReact`

or

```html
<script src="https://unpkg.com/@xstate/react/dist/xstate-react-fsm.umd.min.js"></script>
```

By using the global variable `XStateReactFSM`

2. Import the `useMachine` hook:

```js
import { useMachine } from '@xstate/react';
import { createMachine } from 'xstate';

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

export const Toggler = () => {
  const [state, send] = useMachine(toggleMachine);

  return (
    <button onClick={() => send('TOGGLE')}>
      {state.value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'}
    </button>
  );
};
```

## Examples

- [XState + React TodoMVC (CodeSandbox)](https://codesandbox.io/s/xstate-todomvc-33wr94qv1)

## API

### `useMachine(machine, options?)`

A [React hook](https://reactjs.org/hooks) that interprets the given `machine` and starts a service that runs for the lifetime of the component.

**Arguments**

- `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html) or a function that lazily returns a machine:

  ```js
  // existing machine
  const [state, send] = useMachine(machine);

  // lazily-created machine
  const [state, send] = useMachine(() =>
    createMachine({
      /* ... */
    })
  );
  ```

- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) and/or any of the following machine config options: `guards`, `actions`, `services`, `delays`, `immediate`, `context`, `state`. If the machine already contains any of these options, they will be merged, with these options taking precedence.

**Returns** a tuple of `[state, send, service]`:

- `state` - Represents the current state of the machine as an XState `State` object.
- `send` - A function that sends events to the running service.
- `service` - The created service.

### `useActor(actorLogic, interpreterOptions?)`

A [React hook](https://reactjs.org/hooks) that interprets the given `actorLogic` and starts an actor that runs for the lifetime of the component.

**Arguments**

- `actorLogic` - The actor logic (e.g. `fromPromise(...)`) to interpret.
- `interpreterOptions` (optional) - Interpreter options to pass into `interpret(actorLogic, options)`

**Returns** a tuple of `[state, send, actorRef]`:

- `state` - Represents the current state of the machine as an XState `State` object.
- `send` - A function that sends events to the running actorRef.
- `actorRef` - The created actorRef.

```js
const promiseLogic = fromPromise(async () => {
  const data = await fetch('https://some.api').then((res) => res.json());

  return data;
});

function Component() {
  const [state, send] = useActor(promiseLogic);

  // ...
}
```

### `useActorRef(actorLogic, interpreterOptions?)`

A [React hook](https://reactjs.org/hooks) that interprets the given `actorLogic` and starts an actor that runs for the lifetime of the component.

**Arguments**

- `actorLogic` - The actor logic (e.g. `fromPromise(...)`) to interpret.
- `interpreterOptions` (optional) - Interpreter options to pass into `interpret(actorLogic, options)`

**Returns** the created `actorRef`.

```js
const promiseLogic = fromPromise(async () => {
  const data = await fetch('https://some.api').then((res) => res.json());

  return data;
});

function Component() {
  const actorRef = useActor(promiseLogic);

  const userName = useSelector(actorRef, (data) => data?.name);

  // ...
}
```

### `useSelector(actorRef, selector, compare?, getSnapshot?)`

A React hook that returns the selected value from the snapshot of an `actorRef`, such as a service. This hook will only cause a rerender if the selected value changes, as determined by the optional `compare` function.

**Arguments**

- `actorRef` - an actorRef
- `selector` - a function that takes in an actor's current snapshot as an argument and returns the desired selected value.
- `compare` (optional) - a function that determines if the current selected value is the same as the previous selected value.
- `getSnapshot` (optional) - a function that should return the latest emitted value from the `actor`.
  - Defaults to attempting to get the snapshot from `actor.getSnapshot()`, or returning `undefined` if that does not exist. Will automatically pull the state from services.

```js
import { useSelector } from '@xstate/react';

// tip: optimize selectors by defining them externally when possible
const selectCount = (state) => state.context.count;

const App = ({ service }) => {
  const count = useSelector(service, selectCount);

  // ...
};
```

With `compare` function:

```js
// ...

const selectUser = (state) => state.context.user;
const compareUser = (prevUser, nextUser) => prevUser.id === nextUser.id;

const App = ({ service }) => {
  const user = useSelector(service, selectUser, compareUser);

  // ...
};
```

### `createActorContext(actorLogic)`

Returns a [React Context object](https://beta.reactjs.org/learn/passing-data-deeply-with-context) that interprets the provided `actorLogic` and makes the interpreted actor available through React Context. There are helper methods for accessing state and the actor ref.

**Arguments**

- `actorLogic` - actor logic (e.g., the result of `fromPromise(...)` or `createMachine(...)`)

**Returns**

Returns a React Context object that contains the following properties:

- `Provider` - a React Context Provider component with the following props:
  - `logic` - actor logic to override the `actorLogic` provided to `createActorContext(...)`
  - `options` (optional) - options to pass into `interpret(actorLogic, options)`
- `useSelector(selector, compare?)` - a React hook that takes in a `selector` function and optional `compare` function and returns the selected value from the actor snapshot
- `useActorRef()` - a React hook that returns the actor ref of the interpreted `machine`

Creating a React Context for the actor and providing it in app scope:

```js
import { createActorContext } from '@xstate/react';
import { someMachine } from '../path/to/someMachine';

const SomeMachineContext = createActorContext(someMachine);

function App() {
  return (
    <SomeMachineContext.Provider>
      <SomeComponent />
    </SomeMachineContext.Provider>
  );
}
```

Consuming the actor in a component:

```js
import { SomeMachineContext } from '../path/to/SomeMachineContext';

function SomeComponent() {
  const actorRef = SomeMachineContext.useActorRef();

  // Read full snapshot
  const state = SomeMachineContext.useSelector((s) => s);

  // Or derive a specific value from the snapshot with `useSelector()`
  const count = SomeMachineContext.useSelector((state) => state.context.count);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => actorRef.send({ type: 'INCREMENT' })}>
        Increment
      </button>
    </div>
  );
}
```

Providing a similar machine:

```js
import { SomeMachineContext } from '../path/to/SomeMachineContext';
import { someMachine } from '../path/to/someMachine';

function SomeComponent() {
  return (
    <SomeMachineContext.Provider
      logic={someMachine.provide({
        /* ... */
      })}
    >
      <SomeOtherComponent />
    </SomeMachineContext.Provider>
  );
}
```

### Shallow comparison

The default comparison is a strict reference comparison (`===`). If your selector returns non-primitive values, such as objects or arrays, you should keep this in mind and either return the same reference, or provide a shallow or deep comparator.

The `shallowEqual(...)` comparator function is available for shallow comparison:

```js
import { useSelector, shallowEqual } from '@xstate/react';

// ...

const selectUser = (state) => state.context.user;

const App = ({ actorRef }) => {
  // shallowEqual comparator is needed to compare the object, whose
  // reference might change despite the shallow object values being equal
  const user = useSelector(actorRef, selectUser, shallowEqual);

  // ...
};
```

:::

With `useActorRef(...)`:

```js
import { useActorRef, useSelector } from '@xstate/react';
import { someMachine } from '../path/to/someMachine';

const selectCount = (state) => state.context.count;

const App = () => {
  const actorRef = useActorRef(someMachine);
  const count = useSelector(actorRef, selectCount);

  // ...
};
```

### `useMachine(machine, options?)` with `@xstate/fsm`

A [React hook](https://reactjs.org/hooks) that interprets the given finite state `machine` from [`@xstate/fsm`] and starts a service that runs for the lifetime of the component.

This special `useMachine` hook is imported from `@xstate/react/fsm`

**Arguments**

- `machine` - An [XState finite state machine (FSM)](https://xstate.js.org/docs/packages/xstate-fsm/).
- `options` - An optional `options` object.

**Returns** a tuple of `[state, send, service]`:

- `state` - Represents the current state of the machine as an `@xstate/fsm` `StateMachine.State` object.
- `send` - A function that sends events to the running service.
- `service` - The created `@xstate/fsm` service.

**Example**

```js
import { useEffect } from 'react';
import { useMachine } from '@xstate/react/fsm';
import { createMachine } from '@xstate/fsm';

const context = {
  data: undefined
};
const fetchMachine = createMachine({
  id: 'fetch',
  initial: 'idle',
  context,
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      entry: ['load'],
      on: {
        RESOLVE: {
          target: 'success',
          actions: assign({
            data: (context, event) => event.data
          })
        }
      }
    },
    success: {}
  }
});

const Fetcher = ({
  onFetch = () => new Promise((res) => res('some data'))
}) => {
  const [state, send] = useMachine(fetchMachine, {
    actions: {
      load: () => {
        onFetch().then((res) => {
          send({ type: 'RESOLVE', data: res });
        });
      }
    }
  });

  switch (state.value) {
    case 'idle':
      return <button onClick={(_) => send('FETCH')}>Fetch</button>;
    case 'loading':
      return <div>Loading...</div>;
    case 'success':
      return (
        <div>
          Success! Data: <div data-testid="data">{state.context.data}</div>
        </div>
      );
    default:
      return null;
  }
};
```

## Configuring Machines

Existing machines can be configured by providing machine implementations in `machine.provide({... })`.

Example: the `'fetchData'` service and `'notifySuccess'` action are both configurable:

```js
import { createMachine } from 'xstate';
import { fromPromise } from 'xstate/actors';

const fetchMachine = createMachine({
  id: 'fetch',
  initial: 'idle',
  context: {
    data: undefined,
    error: undefined
  },
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      invoke: {
        src: 'fetchData',
        onDone: {
          target: 'success',
          actions: assign({
            data: ({ event }) => event.data
          })
        },
        onError: {
          target: 'failure',
          actions: assign({
            error: ({ event }) => event.data
          })
        }
      }
    },
    success: {
      entry: 'notifySuccess',
      type: 'final'
    },
    failure: {
      on: {
        RETRY: 'loading'
      }
    }
  }
});

const Fetcher = ({ onResolve }) => {
  const [state, send] = useMachine(
    fetchMachine.provide({
      actions: {
        notifySuccess: ({ context }) => onResolve(context.data)
      },
      actors: {
        fetchData: fromPromise(({ input }) =>
          fetch(`some/api/${input.query}`).then((res) => res.json())
        )
      }
    })
  );

  switch (state.value) {
    case 'idle':
      return (
        <button onClick={() => send({ type: 'FETCH', query: 'something' })}>
          Search for something
        </button>
      );
    case 'loading':
      return <div>Searching...</div>;
    case 'success':
      return <div>Success! Data: {state.context.data}</div>;
    case 'failure':
      return (
        <>
          <p>{state.context.error.message}</p>
          <button onClick={() => send('RETRY')}>Retry</button>
        </>
      );
    default:
      return null;
  }
};
```

## Matching States

When using [hierarchical](https://xstate.js.org/docs/guides/hierarchical.html) and [parallel](https://xstate.js.org/docs/guides/parallel.html) machines, the state values will be objects, not strings. In this case, it is best to use [`state.matches(...)`](https://xstate.js.org/docs/guides/states.html#state-methods-and-getters).

We can do this with `if/else if/else` blocks:

```js
// ...
if (state.matches('idle')) {
  return /* ... */;
} else if (state.matches({ loading: 'user' })) {
  return /* ... */;
} else if (state.matches({ loading: 'friends' })) {
  return /* ... */;
} else {
  return null;
}
```

We can also continue to use `switch`, but we must make an adjustment to our approach. By setting the expression of the `switch` to `true`, we can use [`state.matches(...)`](https://xstate.js.org/docs/guides/states.html#state-methods-and-getters) as a predicate in each `case`:

```js
switch (true) {
  case state.matches('idle'):
    return /* ... */;
  case state.matches({ loading: 'user' }):
    return /* ... */;
  case state.matches({ loading: 'friends' }):
    return /* ... */;
  default:
    return null;
}
```

A ternary statement can also be considered, especially within rendered JSX:

```jsx
const Loader = () => {
  const [state, send] = useMachine(/* ... */);

  return (
    <div>
      {state.matches('idle') ? (
        <Loader.Idle />
      ) : state.matches({ loading: 'user' }) ? (
        <Loader.LoadingUser />
      ) : state.matches({ loading: 'friends' }) ? (
        <Loader.LoadingFriends />
      ) : null}
    </div>
  );
};
```

## Persisted and Rehydrated State

You can persist and rehydrate state with `useMachine(...)` via `options.state`:

```js
// ...

// Get the persisted state config object from somewhere, e.g. localStorage
const persistedState = JSON.parse(localStorage.getItem('some-persisted-state-key')) || someMachine.initialState;

const App = () => {
  const [state, send] = useMachine(someMachine, {
    state: persistedState // provide persisted state config object here
  });

  // state will initially be that persisted state, not the machine's initialState

  return (/* ... */)
}
```

## Resources

[State Machines in React](https://gedd.ski/post/state-machines-in-react/)
