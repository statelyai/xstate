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
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) that you can pass in.

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

## Configuring Machines

Existing machines are configurable with `.useConfig(...)`. The machine passed into `useMachine` will remain static for the entire lifetime of the component (it is important that state machines are the least dynamic part of the code).

::: tip
The [`useMemo` hook](TODO) is an important performance optimization when creating a machine with custom config inside of a React component. It ensures that the machine isn't recreated every time the component rerenders.
:::

Example: the `'fetchData'` service and `'notifyChanged'` action are both configurable:

```js
const fetchMachine = Machine({
  id: 'fetch',
  initial: 'idle',
  context: {
    data: undefined
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
            data: (_, e) => e.data
          })
        }
      }
    },
    success: {
      onEntry: 'notifyResolve',
      type: 'final'
    }
  }
});

const Fetcher = ({ onResolve }) => {
  const customFetchMachine = useMemo(
    () =>
      fetchMachine.withContext({
        actions: {
          notifyResolve: ctx => {
            onResolve(ctx.data);
          }
        },
        services: {
          fetchData: (ctx, e) =>
            fetch(`some/api/${e.query}`).then(res => res.json())
        }
      }),
    [] // Machine should never change
  );

  const [current, send] = useMachine(customFetchMachine);

  switch (current.state) {
    case 'idle':
      return (
        <button onClick={() => send({ type: 'FETCH', query: 'something' })}>
          Search for something
        </button>
      );
    case 'loading':
      return <div>Searching...</div>;
    case 'success':
      return <div>Success! Data: {current.context.data}</div>;
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
      ) : current.matches({ loading: 'frends' }) ? (
        <Loader.LoadingFriends />
      ) : null}
    </div>
  );
};
```
