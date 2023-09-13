# @xstate/solid

The [@xstate/solid package](https://github.com/statelyai/xstate/tree/main/packages/xstate-solid) contains utilities for using [XState](https://github.com/statelyai/xstate) with [SolidJS](https://github.com/solidjs/solid).

[[toc]]

## Quick Start

1. Install `xstate` and `@xstate/solid`:

```bash
npm i xstate @xstate/solid
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/solid/dist/xstate-solid.umd.min.js"></script>
```

By using the global variable `XStateSolid`

2. Import the `useMachine` hook:

```js
import { useMachine } from '@xstate/solid';
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
    <button onclick={() => send({ type: 'TOGGLE' })}>
      {state.value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'}
    </button>
  );
};
```

## API

### `useMachine(machine, options?)`

A SolidJS hook that interprets the given `machine` and starts a service that runs for the lifetime of the component.

**Arguments**

- `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html):

  ```js
  // existing machine
  const [state, send] = useMachine(machine);
  ```

- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) and/or any of the following machine config options: `guards`, `actions`, `services`, `delays`, `context`, `state`.

**Returns** a tuple of `[state, send, service]`:

- `state` - Represents the current state of the machine as an XState `State` object. This is a read-only value that is tracked by SolidJS for granular reactivity.
- `send` - A function that sends events to the running service.
- `service` - The created service.

### `useActor(actor)`

A SolidJS hook that subscribes to emitted changes from an existing [actor](https://xstate.js.org/docs/guides/actors.html).

**Arguments**

- `actor` - an actor-like object that contains `.send(...)` and `.subscribe(...)` methods. Allows [SolidJS Signal](https://www.solidjs.com/docs/latest/api#createsignal) (or function) to dynamically specify an actor.

```js
const [state, send] = useActor(someSpawnedActor);
```

### `createService(machine, options?)`

A SolidJS hook that returns the `service` created from the `machine` with the `options`, if specified. It starts the service and runs it for the lifetime of the component. This is similar to `useMachine`.

`createService` returns a static reference (to just the interpreted machine) which will not rerender when its state changes.

**Arguments**

- `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html) or a function that lazily returns a machine.
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) and/or any of the following machine config options: `guards`, `actions`, `services`, `delays`, `context`, `state`.

```js
import { createService } from '@xstate/solid';
import { someMachine } from '../path/to/someMachine';

const App = () => {
  const service = createService(someMachine);

  // ...
};
```

With options:

```js
// ...

const App = () => {
  const service = createService(someMachine, {
    actions: {
      /* ... */
    }
  });

  // ...
};
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

  return (
    <Switch fallback={null}>
      <Match when={state.matches('idle')}>
        <button onClick={() => send({ type: 'FETCH', query: 'something' })}>
          Search for something
        </button>
      </Match>
      <Match when={state.matches('loading')}>
        <div>Searching...</div>
      </Match>
      <Match when={state.matches('success')}>
        <div>Success! Data: {state.context.data}</div>
      </Match>
      <Match when={state.matches('failure')}>
        <div>
          <p>{state.context.error.message}</p>
          <button onClick={() => send({ type: 'RETRY' })}>Retry</button>
        </div>
      </Match>
    </Switch>
  );
};
```

## Matching States

When using [hierarchical](https://xstate.js.org/docs/guides/hierarchical.html) and [parallel](https://xstate.js.org/docs/guides/parallel.html) machines, the state values will be objects, not strings. In this case, it is best to use [`state.matches(...)`](https://xstate.js.org/docs/guides/states.html#state-methods-and-getters).

The SolidJS [Switch and Match Components]() are ideal for this use case:

```jsx
const Loader = () => {
  const [state, send] = useMachine(/* ... */);

  return (
    <div>
      <Switch fallback={null}>
        <Match when={state.matches('idle')}>
          <Loader.Idle />
        </Match>
        <Match when={state.matches({ loading: 'user' })}>
          <Loader.LoadingUser />
        </Match>
        <Match when={state.matches({ loading: 'friends' })}>
          <Loader.LoadingFriends />
        </Match>
      </Switch>
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

You can subscribe to that service's state changes with the [`createEffect` hook](https://www.solidjs.com/docs/latest/api#createeffect):

```js
// ...

createEffect(() => {
  const subscription = service.subscribe((state) => {
    // simple state logging
    console.log(state);
  });

  onCleanup(() => subscription.unsubscribe());
}); // note: service should never change
```

Or by using the [`from` utility](https://www.solidjs.com/docs/latest/api#from). Note that this returns a shallow signal and is not deeply reactive

```js
const serviceState = from(service); // Returns an auto updating signal that subscribes/unsubscribes for you
```
