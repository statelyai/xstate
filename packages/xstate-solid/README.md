# @xstate/solid

The [@xstate/solid package](https://github.com/statelyai/xstate/tree/main/packages/xstate-solid) contains utilities for using [XState](https://github.com/statelyai/xstate) with [SolidJS](https://github.com/solidjs/solid).

[[toc]]

## Quick Start

1. Install `xstate` and `@xstate/solid`:

```bash
npm i xstate @xstate/solid
```

2. Import the `useActor` hook:

```js
import { useActor } from '@xstate/solid';
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
  const [snapshot, send] = useActor(toggleMachine);

  return (
    <button onclick={() => send({ type: 'TOGGLE' })}>
      {snapshot.value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'}
    </button>
  );
};
```

## API

### `useActor(logic, options?)`

A SolidJS hook that interprets the given `logic` and starts an actor that runs for the lifetime of the component.

**Arguments**

- `logic`

  ```js
  // existing machine
  const [snapshot, send] = useMachine(machine);
  ```

**Returns** a tuple of `[snapshot, send, actorRef]`:

- `snapshot` - Represents the current snapshot of the logic. This is a read-only value that is tracked by SolidJS for granular reactivity.
- `send` - A function that sends events to the running service.
- `actorRef` - The created service.

### `fromActorRef(actorRf)`

A SolidJS hook that subscribes to emitted changes from an existing [actor](https://xstate.js.org/docs/guides/actors.html).

**Arguments**

- `actorRef` - an actor object that contains `.send(...)` and `.subscribe(...)` methods. Allows [SolidJS Signal](https://www.solidjs.com/docs/latest/api#createsignal) (or function) to dynamically specify an actor.

```js
const snapshot = fromActorRef(someSpawnedActor);
```

### `useActorRef(logic, options?)`

A SolidJS hook that returns the `actorRef` created from the `logic` with the `options`, if specified. It starts the actor and runs it for the lifetime of the component. This is similar to `useActor`.

`createService` returns a static reference (to just the interpreted logic) which will not rerender when its snapshot changes.

**Arguments**

- `logic`
- `options` (optional) - [Actor options](https://xstate.js.org/docs/guides/interpretation.html#options)

```js
import { useActorRef } from '@xstate/solid';
import { someMachine } from '../path/to/someMachine';

const App = () => {
  const actorRef = useActorRef(someMachine);

  // ...
};
```

With options:

```js
// ...

const App = () => {
  const service = useActorRef(someMachine, {
    input: {
      /* ... */
    }
  });

  // ...
};
```

## Matching States

When using [hierarchical](https://xstate.js.org/docs/guides/hierarchical.html) and [parallel](https://xstate.js.org/docs/guides/parallel.html) machines, the state values will be objects, not strings. In this case, it is best to use [`state.matches(...)`](https://xstate.js.org/docs/guides/states.html#state-methods-and-getters).

The SolidJS [Switch and Match Components]() are ideal for this use case:

```jsx
const Loader = () => {
  const [snapshot, send] = useActor(/* ... */);

  return (
    <div>
      <Switch fallback={null}>
        <Match when={snapshot.matches('idle')}>
          <Loader.Idle />
        </Match>
        <Match when={snapshot.matches({ loading: 'user' })}>
          <Loader.LoadingUser />
        </Match>
        <Match when={snapshot.matches({ loading: 'friends' })}>
          <Loader.LoadingFriends />
        </Match>
      </Switch>
    </div>
  );
};
```

## Persisted and Rehydrated State

You can persist and rehydrate state with `useActor(...)` via `options.snapshot`:

```js
// ...

// Get the persisted state config object from somewhere, e.g. localStorage
const persistedSnapshot = JSON.parse(localStorage.getItem('some-persisted-state-key')) || someMachine.initialState;

const App = () => {
  const [snapshot, send] = useActor(someMachine, {
    snapshot: persistedSnapshot
  });

  // snapshot will rehydrate the provided persisted snapshot, it won't be the machine's initial snapshot

  return (/* ... */)
}
```

## Actor refs

The `actorRef` created in `useActor(logic)` can be referenced as the third returned value:

```js
//                  vvvvvvv
const [snapshot, send, actorRef] = useActor(someMachine);
```

You can subscribe to that `actorRef`'s snapshot changes with the [`createEffect` hook](https://www.solidjs.com/docs/latest/api#createeffect):

```js
// ...

createEffect(() => {
  const subscription = actorRef.subscribe((snapshot) => {
    // simple snapshot logging
    console.log(snapshot);
  });

  onCleanup(() => subscription.unsubscribe());
}); // note: service should never change
```
