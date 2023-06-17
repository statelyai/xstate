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

or

```html
<script src="https://unpkg.com/@xstate/solid/dist/xstate-solid-fsm.umd.min.js"></script>
```

By using the global variable `XStateSolidFSM`

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

- `options?` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options)

**Returns** a tuple of `[state, send, actor]`:

- `state` - Represents the current state of the machine as an XState `State` object. This is a read-only value that is tracked by SolidJS for granular reactivity.
- `send` - A function that sends events to the running actor.
- `actor` - The created actor.

### `useActor(actorLogic, options?)`

A SolidJS hook that subscribes to emitted changes from actor.

**Arguments**

- `actorLogic` - Actor logic
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options)

```js
const [state, send] = useActor(
  fromPromise(() => fetch('/api').then((res) => res.json()))
);
```

### `createActorRef(actorLogic, options?)`

A SolidJS hook that returns the `actor` created from the `actorLogic` with the interpreter `options`, if specified. It starts the actor and runs it for the lifetime of the component. This is similar to `useActor(...)`.

`createActorRef(...)` returns a static reference (to just the actor ref) which will not rerender when its state changes.

**Arguments**

- `machine` - Actor logic
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options)

```js
import { createActorRef } from '@xstate/solid';
import { someLogic } from '../path/to/someLogic';

const App = () => {
  const actorRef = createActorRef(someLogic);

  createEffect(() => {
    actorRef.subscribe((snapshot) => {
      // ...
    });
  });
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

You can persist and rehydrate state with `useMachine(machine, options)` or `useActor(logic, options) via `options.state`:

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

## Actors

The `actor` created in `useMachine(machine)` or `useActor(logic)` can be referenced as the third returned value:

```js
//                     vvvvv
const [snapshot, send, actor] = useMachine(someMachine);
```

You can subscribe to that actor's snapshot changes with the [`createEffect` hook](https://www.solidjs.com/docs/latest/api#createeffect):

```js
// ...

createEffect(() => {
  const subscription = actor.subscribe((snapshot) => {
    // simple snapshot logging
    console.log(snapshot);
  });

  onCleanup(() => subscription.unsubscribe());
}); // note: actor should never change
```

Or by using the [`from` utility](https://www.solidjs.com/docs/latest/api#from). Note that this returns a shallow signal and is not deeply reactive.

```js
const actorSnapshot = from(actor); // Returns an auto updating signal that subscribes/unsubscribes for you
```
