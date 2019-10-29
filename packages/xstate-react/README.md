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
  const [current, send] = useMachine(toggleMachine);

  return (
    <button onClick={() => send('TOGGLE')}>
      {current.value === 'inactive'
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

**Returns** a tuple of `[current, send, service]`:

- `current` - Represents the current state of the machine as an XState `State` object.
- `send` - A function that sends events to the running service.
- `service` - The created service.

### `useService(service)`

A [React hook](https://reactjs.org/hooks) that subscribes to state changes from an existing [service](TODO).

**Arguments**

- `service` - An [XState service](https://xstate.js.org/docs/guides/communication.html).

**Returns** a tuple of `[current, send]`:

- `current` - Represents the current state of the service as an XState `State` object.
- `send` - A function that sends events to the running service.

### `useActor(actor)` <Badge text="0.8+"/>

A [React hook](https://reactjs.org/hooks) that subscribes to messages (events) from actors, and can send messages (events) to actors.

**Arguments**

- `actor` - An actor-like object, which has `.subscribe(listener)` and `.send(event)` methods.

**Returns** a tuple of `[current, send]`:

- `current` - Represents the current message sent from the actor.
- `send` - A function that sends events to the actor.

### `useMachine(machine)` with `@xstate/fsm` <Badge text="1.1+"/>

A [React hook](https://reactjs.org/hooks) that interprets the given finite state `machine` from [`@xstate/fsm`] and starts a service that runs for the lifetime of the component.

This special `useMachine` hook is imported from `@xstate/react/lib/fsm`

**Arguments**

- `machine` - An [XState finite state machine (FSM)](https://xstate.js.org/docs/packages/xstate-fsm/).

**Returns** a tuple of `[current, send, service]`:

- `current` - Represents the current state of the machine as an `@xstate/fsm` `StateMachine.State` object.
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
  const [current, send] = useMachine(fetchMachine);

  useEffect(() => {
    current.actions.forEach(action => {
      if (action.type === 'load') {
        onFetch().then(res => {
          send({ type: 'RESOLVE', data: res });
        });
      }
    });
  }, [current]);

  switch (current.value) {
    case 'idle':
      return <button onClick={_ => send('FETCH')}>Fetch</button>;
    case 'loading':
      return <div>Loading...</div>;
    case 'success':
      return (
        <div>
          Success! Data: <div data-testid="data">{current.context.data}</div>
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
  const [current, send] = useMachine(fetchMachine, {
    actions: {
      notifySuccess: ctx => onResolve(ctx.data)
    },
    services: {
      fetchData: (_, e) => fetch(`some/api/${e.query}`).then(res => res.json())
    }
  });

  switch (current.value) {
    case 'idle':
      return (
        <button onClick={() => send('FETCH', { query: 'something' })}>
          Search for something
        </button>
      );
    case 'loading':
      return <div>Searching...</div>;
    case 'success':
      return <div>Success! Data: {current.context.data}</div>;
    case 'failure':
      return (
        <>
          <p>{current.context.error.message}</p>
          <button onClick={() => send('RETRY')}>Retry</button>
        </>
      );
    default:
      return null;
  }
};
```

## Matching States

Using a `switch` statement might suffice for a simple, non-hierarchical state machine, but for [hierarchical](https://xstate.js.org/docs/guides/hierarchical.html) and [parallel](https://xstate.js.org/docs/guides/parallel.html) machines, the state values will be objects, not strings. In this case, it's better to use [`state.matches(...)`](https://xstate.js.org/docs/guides/states.html#state-methods-and-getters):

```js
// ...
if (current.matches('idle')) {
  return /* ... */;
} else if (current.matches({ loading: 'user' })) {
  return /* ... */;
} else if (current.matches({ loading: 'friends' })) {
  return /* ... */;
} else {
  return null;
}
```

A ternary statement can also be considered, especially within rendered JSX:

```jsx
const Loader = () => {
  const [current, send] = useMachine(/* ... */);

  return (
    <div>
      {current.matches('idle') ? (
        <Loader.Idle />
      ) : current.matches({ loading: 'user' }) ? (
        <Loader.LoadingUser />
      ) : current.matches({ loading: 'friends' }) ? (
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
const persistedState = JSON.parse(localStorage.get('some-persisted-state-key'));

const App = () => {
  const [current, send] = useMachine(someMachine, {
    state: persistedState // provide persisted state config object here
  });

  // current will initially be that persisted state, not the machine's initialState

  return (/* ... */)
}
```

## Resources

[State Machines in React](https://gedd.ski/post/state-machines-in-react/)
