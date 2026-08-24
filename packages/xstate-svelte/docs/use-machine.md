---
title: Use a machine in Svelte
description: Run XState logic in a Svelte component with useActor and useActorRef.
---

```bash
npm install xstate@alpha @xstate/svelte@alpha
```

`@xstate/svelte` provides four functions: `useActor(...)`, `useActorRef(...)`, `useSelector(...)` and `useMachine(...)`. They work with Svelte 3, 4 and 5.

```svelte
<script lang="ts">
  import { useActor } from '@xstate/svelte';
  import { createMachine } from 'xstate';

  const playerMachine = createMachine({
    context: { volume: 5 },
    initial: 'paused',
    states: {
      paused: { on: { play: { target: 'playing' } } },
      playing: {
        on: {
          pause: { target: 'paused' },
          volume: ({ context, event }) => ({
            context: { ...context, volume: event.level }
          })
        }
      }
    }
  });

  const { snapshot, send } = useActor(playerMachine);
</script>

<button on:click={() => send({ type: 'play' })}>Play</button>
<output>{$snapshot.value}</output>
```

## What useActor returns

| Member | Type | Description |
| --- | --- | --- |
| `snapshot` | `Readable<SnapshotFrom<TLogic>>` | Svelte readable store holding the latest [snapshot](../snapshots.md). |
| `send` | `(event) => void` | Sends an event to the actor. |
| `actorRef` | `Actor<TLogic>` | The running actor, for `subscribe(...)`, `getPersistedSnapshot()` or passing to children. |

`snapshot` is a store, so read it as `$snapshot` in markup and reactive statements, and as `get(snapshot)` or `actorRef.getSnapshot()` in plain script code.

`useActor(...)` accepts any [actor logic](../actor-logic.md), not only machines: a machine, an async logic, or a callback logic.

## Options

The second argument is the same [actor options](../create-actor.md) object accepted by `createActor(...)`: `input`, `snapshot`, `id`, `registryKey`, `clock`, `logger`, `inspect`. It is required when the logic requires input.

```ts
const { snapshot, send } = useActor(uploadMachine, {
  input: { fileId },
  registryKey: 'upload'
});
```

Options are read once, when the component initializes. Changing the values later does not restart the actor. Send an event instead.

## Lifecycle

`useActorRef(...)`, which `useActor(...)` builds on, starts the actor immediately during component initialization and stops it in `onDestroy`.

- The actor is already running while the component's script body runs, so the first render sees a live snapshot.
- Unlike a plain Svelte store, the actor's life does not depend on subscribers. Subscribing and unsubscribing to `snapshot` (for example, a `{#if}` block that removes the last reader) never stops the actor.
- On destroy the actor is stopped: invoked children stop, delayed transitions are cancelled and further events are ignored.

State does not survive destruction. Persist the snapshot if the actor should resume later. See [Input and restored snapshots](input-and-snapshots.md).

> **Warning:** These functions call `onDestroy` internally, so they must run during component initialization. Calling them from an event handler or a `setTimeout` leaves the actor running after the component is gone.

## useActorRef

`useActorRef(logic, options?)` returns only the actor. No store is created, so nothing re-renders on a transition unless a selector asks for it.

```svelte
<script lang="ts">
  import { useActorRef, useSelector } from '@xstate/svelte';

  const actorRef = useActorRef(checkoutMachine, { input: { cartId } });
  const total = useSelector(actorRef, (s) => s.context.total);
</script>
```

Unlike the Vue package, there is no observer or listener argument. Call `actorRef.subscribe(...)` yourself when you need one, and unsubscribe in `onDestroy`.

## useMachine

`useMachine(machine, options?)` is an alias of `useActor(...)` restricted to machine logic, returning the same `{ snapshot, send, actorRef }`. New code can use `useActor(...)` for everything.

## TypeScript

Snapshot, event and input types are inferred from the logic. Type a prop that carries an actor with `ActorRefFrom`:

```ts
import type { ActorRefFrom } from 'xstate';

export let actorRef: ActorRefFrom<typeof checkoutMachine>;
```

## Svelte helpers cheatsheet

```ts
const { snapshot, send, actorRef } = useActor(logic, options);
const actorRef = useActorRef(logic, options);
const value = useSelector(actorRef, (snapshot) => snapshot.context.value);
const { snapshot, send, actorRef } = useMachine(machine, options); // alias
```
