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

- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) and/or any of the following machine config options: `guards`, `actions`, `services`, `delays`, `immediate`, `context`, `state`.

**Returns** a tuple of `[state, send, service]`:

- `state` - Represents the current state of the machine as an XState `State` object.
- `send` - A function that sends events to the running service.
- `service` - The created service.

### `useActor(actor, getSnapshot?)`

A [React hook](https://reactjs.org/hooks) that subscribes to emitted changes from an existing [actor](https://xstate.js.org/docs/guides/actors.html).

**Arguments**

- `actor` - an actor-like object that contains `.send(...)` and `.subscribe(...)` methods.
- `getSnapshot` - a function that should return the latest emitted value from the `actor`.
  - Defaults to attempting to get the snapshot from `actor.getSnapshot()`, or returning `undefined` if that does not exist.

```js
const [state, send] = useActor(someSpawnedActor);

// with custom actors
const [state, send] = useActor(customActor, (actor) => {
  // implementation-specific pseudocode example:
  return actor.getLastEmittedValue();
});
```

### `useInterpret(machine, options?, observer?)`

A React hook that returns the `service` created from the `machine` with the `options`, if specified. It starts the service and runs it for the lifetime of the component. This is similar to `useMachine`; however, `useInterpret` allows for a custom `observer` to subscribe to the `service`.

The `useInterpret` is useful when you want fine-grained control, e.g. to add logging, or minimize re-renders. In contrast to `useMachine` that would flush each update from the machine to the React component, `useInterpret` instead returns a static reference (to just the interpreted machine) which will not rerender when its state changes.

To use a piece of state from the service inside a render, use the `useSelector(...)` hook to subscribe to it.

_Since 1.3.0_

**Arguments**

- `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html) or a function that lazily returns a machine.
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) and/or any of the following machine config options: `guards`, `actions`, `services`, `delays`, `immediate`, `context`, `state`.
- `observer` (optional) - an observer or listener that listens to state updates:
  - an observer (e.g., `{ next: (state) => {/* ... */} }`)
  - or a listener (e.g., `(state) => {/* ... */}`)

```js
import { useInterpret } from '@xstate/react';
import { someMachine } from '../path/to/someMachine';

const App = () => {
  const service = useInterpret(someMachine);

  // ...
};
```

With options + listener:

```js
// ...

const App = () => {
  const service = useInterpret(
    someMachine,
    {
      actions: {
        /* ... */
      }
    },
    (state) => {
      // subscribes to state changes
      console.log(state);
    }
  );

  // ...
};
```

### `useSelector(actor, selector, compare?, getSnapshot?)`

A React hook that returns the selected value from the snapshot of an `actor`, such as a service. This hook will only cause a rerender if the selected value changes, as determined by the optional `compare` function.

_Since 1.3.0_

**Arguments**

- `actor` - a service or an actor-like object that contains `.send(...)` and `.subscribe(...)` methods.
- `selector` - a function that takes in an actor's "current state" (snapshot) as an argument and returns the desired selected value.
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

With `useInterpret(...)`:

```js
import { useInterpret, useSelector } from '@xstate/react';
import { someMachine } from '../path/to/someMachine';

const selectCount = (state) => state.context.count;

const App = ({ service }) => {
  const service = useInterpret(someMachine);
  const count = useSelector(service, selectCount);

  // ...
};
```

### `createActorContext(machine)`

_Since 3.1.0_

Returns a [React Context object](https://beta.reactjs.org/learn/passing-data-deeply-with-context) that interprets the `machine` and makes the interpreted actor available through React Context. There are helper methods for accessing state and the actor ref.

**Arguments**

- `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html) or a function that lazily returns a machine.

**Returns**

Returns a React Context object that contains the following properties:

- `Provider` - a React Context Provider component with the following props:
  - `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html) that must be of the same type as the machine passed to `createActorContext(...)`
- `useActor()` - a React hook that returns a tuple of `[state, send]` from the React Context
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
  // Read full snapshot and get `send` function from `useActor()`
  const [state, send] = SomeMachineContext.useActor();
  // Or derive a specific value from the snapshot with `useSelector()`
  const count = SomeMachineContext.useSelector((state) => state.context.count);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => send('INCREMENT')}>Increment</button>
    </div>
  );
}
```

Reading the actor ref:

```js
import { SomeMachineContext } from '../path/to/SomeMachineContext';
function SomeComponent() {
  const actorRef = SomeMachineContext.useActorRef();
  return (
    <div>
      <button onClick={() => actorRef.send('INCREMENT')}>Increment</button>
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
      machine={() =>
        someMachine.withConfig({
          /* ... */
        })
      }
    >
      <SomeOtherComponent />
    </SomeMachineContext.Provider>
  );
}
```

## Configuring Machines

Existing machines can be configured by passing the machine options as the 2nd argument of `useMachine(machine, options)`.

Example: the `'fetchData'` service and `'notifySuccess'` action are both configurable:

```js
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
            data: (_, event) => event.data
          })
        },
        onError: {
          target: 'failure',
          actions: assign({
            error: (_, event) => event.data
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
  const [state, send] = useMachine(fetchMachine, {
    actions: {
      notifySuccess: (ctx) => onResolve(ctx.data)
    },
    services: {
      fetchData: (_, e) =>
        fetch(`some/api/${e.query}`).then((res) => res.json())
    }
  });

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

## Services

The `service` created in `useMachine(machine)` can be referenced as the third returned value:

```js
//                  vvvvvvv
const [state, send, service] = useMachine(someMachine);
```

You can subscribe to that service's state changes with the [`useEffect` hook](https://reactjs.org/docs/hooks-effect.html):

```js
// ...

useEffect(() => {
  const subscription = service.subscribe((state) => {
    // simple state logging
    console.log(state);
  });

  return subscription.unsubscribe;
}, [service]); // note: service should never change
```

## Resources

[State Machines in React](https://gedd.ski/post/state-machines-in-react/)
