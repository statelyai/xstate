---
title: Use a machine in React
description: Run XState actor logic in a React component.
---

Install XState and the React package.

```bash
npm install xstate@alpha @xstate/react@alpha
```

`useActor(logic, options?)` creates an actor for the component, starts it, and re-renders when it produces a new snapshot.

```tsx
import { useActor } from '@xstate/react';
import { createMachine } from 'xstate';

const playerMachine = createMachine({
  initial: 'paused',
  states: {
    paused: { on: { play: { target: 'playing' } } },
    playing: { on: { pause: { target: 'paused' } } }
  }
});

export function Player() {
  const [snapshot, send] = useActor(playerMachine);

  return (
    <button onClick={() => send({ type: 'play' })}>
      {snapshot.matches('playing') ? 'Playing' : 'Play'}
    </button>
  );
}
```

The returned tuple is `[snapshot, send, actorRef]`. The third member is the full [actor](../create-actor.md), useful for `actorRef.trigger`, `actorRef.on(...)` and passing a reference to children.

```tsx
const [snapshot, send, actorRef] = useActor(playerMachine);

<button onClick={() => actorRef.trigger.play()}>Play</button>;
```

`actorRef.trigger` is typed from the machine's `schemas.events`. See [TypeScript](../typescript.md).

## Options

The second argument accepts the same [actor options](../create-actor.md#actor-options) as `createActor(...)`: `input`, `snapshot`, `id`, `inspect`, `clock`, `logger` and `registryKey`. It is required when the logic requires input.

```tsx
const [snapshot, send] = useActor(uploadMachine, {
  input: { fileId },
  inspect: (event) => console.log(event)
});
```

Options are read when the actor is created. Changing `input` on a later render does not restart the actor — see [input and snapshots](input-and-snapshots.md).

## Re-render semantics

`useActor` subscribes with `useSyncExternalStore`, so the component re-renders whenever the actor produces a new snapshot object. An event that takes no transition produces the same snapshot reference, and React bails out of the render.

That still means every state or context change re-renders the component. When a component only needs one value from a long-lived actor, use `useActorRef(...)` with [`useSelector(...)`](selectors.md) instead.

```tsx
const actorRef = useActorRef(playerMachine);
const isPlaying = useSelector(actorRef, (s) => s.matches('playing'));
```

`useActorRef(logic, options?, observerOrListener?)` creates and starts an actor without subscribing to it, so it never re-renders on its own. The optional third argument is a snapshot listener function or an [observer object](../create-actor.md#subscribing), subscribed for as long as it is provided. Memoize it with `useCallback`; a new function identity re-subscribes.

```tsx
const onSnapshot = useCallback(
  (snapshot) => {
    if (snapshot.status === 'done') navigate('/receipt');
  },
  [navigate]
);

const actorRef = useActorRef(checkoutMachine, undefined, onSnapshot);
```

If the actor reaches an `error` snapshot, `useActor` throws the error during render, so an error boundary can catch it. `useActorRef` does not.

> **Warning:** `useActor` takes actor *logic*, not an actor reference. Passing an existing `actorRef` throws in development. Read from an existing actor with [`useSelector`](selectors.md).

## Actor lifecycle

One actor is created per component instance. It starts in an effect after mount and is stopped on unmount.

React StrictMode disconnects and immediately reconnects effects in development. `useActor` and `useActorRef` defer cleanup by one microtask, so that immediate reconnect cancels the pending stop and preserves the actor and its children. A real unmount still stops the actor. If an actor was stopped externally before an effect reconnects, the hooks create a fresh actor from the same logic and options; an actor that completed naturally (`done` or `error`) is left alone.

Changing the logic identity between renders is handled separately: when the config of the logic passed in differs from the running actor's, a new actor is created from the current logic and seeded with the previous actor's persisted snapshot, so the component keeps its state. Implementations swapped with `machine.provide({ ... })` in the component body keep the same config, so they update the running actor in place rather than replacing it. A guard or action defined in render always sees the latest props.

`useMachine(...)` is a deprecated alias for `useActor(machine, options)`. It accepts state machines only. Use `useActor(...)`.

## TypeScript

Snapshot, event and actor reference types are inferred from the actor logic. `options` becomes a required argument when the logic requires input.

```tsx
import type { SnapshotFrom } from 'xstate';

const [snapshot, send] = useActor(playerMachine);
snapshot.context; // typed
send({ type: 'play' }); // typed

type PlayerSnapshot = SnapshotFrom<typeof playerMachine>;
```

## React hooks cheatsheet

```tsx
const [snapshot, send, actorRef] = useActor(logic, options);
const actorRef = useActorRef(logic, options, observerOrListener);
const value = useSelector(actorRef, (snapshot) => snapshot.context.value);

send({ type: 'play' });
actorRef.trigger.play();
actorRef.on('played', (event) => analytics.track(event));
```
