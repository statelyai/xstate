# @xstate/react

## Quick Start

1. Install `xstate` and `@xstate/react`:

```bash
npm i xstate @xstate/react
```

2. Import the `useMachine` hook:

```js
import { useMachine } from '@xstate/react';
import { Machine } from 'xstate';

const toggleMachine = Machine({
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

## API

### `useMachine(machine, options?)`

A [React hook](https://reactjs.org/hooks) that interprets the given `machine` and starts a service that runs for the lifetime of the component.

**Arguments**

- `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html).
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) OR one of the following Machine Config options: `guards`, `actions`, `activities`, `services`, `delays`, `immediate`, `context`, or `state`.

**Returns** a tuple of `[state, send, service]`:

- `state` - Represents the current state of the machine as an XState `State` object.
- `send` - A function that sends events to the running service.
- `service` - The created service.

### `useService(service)`

A [React hook](https://reactjs.org/hooks) that subscribes to state changes from an existing [service](TODO).

**Arguments**

- `service` - An [XState service](https://xstate.js.org/docs/guides/communication.html).

**Returns** a tuple of `[state, send]`:

- `state` - Represents the current state of the service as an XState `State` object.
- `send` - A function that sends events to the running service.

### `asEffect(action)`

Ensures that the `action` is executed as an effect in `useEffect`, rather than being immediately executed.

**Arguments**

- `action` - An action function (e.g., `(context, event) => { alert(context.message) })`)

**Returns** a special action function that wraps the original so that `useMachine` knows to execute it in `useEffect`.

**Example**

```jsx
const machine = createMachine({
  initial: 'focused',
  states: {
    focused: {
      entry: 'focus'
    }
  }
});

const Input = () => {
  const inputRef = useRef(null);
  const [state, send] = useMachine(machine, {
    actions: {
      focus: asEffect((context, event) => {
        inputRef.current && inputRef.current.focus();
      })
    }
  });

  return <input ref={inputRef} />;
};
```

### `asLayoutEffect(action)`

Ensures that the `action` is executed as an effect in `useLayoutEffect`, rather than being immediately executed.

**Arguments**

- `action` - An action function (e.g., `(context, event) => { alert(context.message) })`)

**Returns** a special action function that wraps the original so that `useMachine` knows to execute it in `useLayoutEffect`.

### `useMachine(machine)` with `@xstate/fsm`

A [React hook](https://reactjs.org/hooks) that interprets the given finite state `machine` from [`@xstate/fsm`] and starts a service that runs for the lifetime of the component.

This special `useMachine` hook is imported from `@xstate/react/lib/fsm`

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
import { useMachine } from `@xstate/react/lib/fsm`;
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

const Fetcher = ({ onFetch = () => new Promise(res => res('some data')) }) => {
  const [state, send] = useMachine(fetchMachine, {
    actions: {
      load: () => {
        onFetch().then(res => {
          send({ type: 'RESOLVE', data: res });
        });
      }
    }
  });

  switch (state.value) {
    case 'idle':
      return <button onClick={_ => send('FETCH')}>Fetch</button>;
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

## Configuring Machines <Badge text="0.7+"/>

Existing machines can be configured by passing the machine options as the 2nd argument of `useMachine(machine, options)`.

Example: the `'fetchData'` service and `'notifySuccess'` action are both configurable:

```js
const fetchMachine = Machine({
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
        <button onClick={() => send('FETCH', { query: 'something' })}>
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
const persistedState = JSON.parse(localStorage.getItem('some-persisted-state-key'));

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
