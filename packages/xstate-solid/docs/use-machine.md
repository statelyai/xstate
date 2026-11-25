---
title: Use a machine in Solid
description: Run XState logic in a Solid component with useActor and useActorRef.
---

```bash
npm install xstate@alpha @xstate/solid@alpha
```

`@xstate/solid` provides four primitives: `useActor(...)`, `useActorRef(...)`, `fromActorRef(...)` and `useMachine(...)`. They require Solid 2.0.1 or later.

```tsx
import { Show } from 'solid-js';
import { useActor } from '@xstate/solid';
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

export function MediaPlayer() {
  const [snapshot, send] = useActor(playerMachine);

  return (
    <>
      <button onClick={() => send({ type: 'play' })}>Play</button>
      <Show when={snapshot.matches('playing')}>
        <output>Volume: {snapshot.context.volume}</output>
      </Show>
    </>
  );
}
```

## What useActor returns

`useActor(...)` returns a tuple, not an object.

| Index | Value | Description |
| --- | --- | --- |
| `0` | `snapshot` | A deeply reactive [snapshot](../snapshots.md): a Solid store, not an accessor. |
| `1` | `send` | Sends an event to the actor. |
| `2` | `actorRef` | The running actor, for `subscribe(...)`, `getPersistedSnapshot()` or passing to children. |

The snapshot is read directly, as in `snapshot.context.volume` or `snapshot.matches('playing')`, with no call parentheses. Each property access is its own reactive dependency, so a component that reads `snapshot.context.volume` does not re-run when an unrelated part of context changes.

`useActor(...)` accepts any [actor logic](../actor-logic.md), not only machines: a machine, an async logic, or a callback logic.

> **Warning:** Destructuring the snapshot (`const { context } = snapshot`) reads the value once and loses reactivity, as with any Solid store. Keep the property access inside JSX, a `createMemo(...)` or an effect.

## Options

The second argument is the same [actor options](../create-actor.md) object accepted by `createActor(...)`: `input`, `id`, `registryKey`, `clock`, `logger`, `inspect`. It is required when the logic requires input. To resume a persisted actor, pass an actor created with `restoreActor(...)` from `xstate/persist` instead of the logic; see [Input and restored snapshots](input-and-snapshots.md).

```ts
const [snapshot, send] = useActor(uploadMachine, { registryKey: 'upload' });
```

Options are read once, when the actor is created.

## Deriving the actor

When the actor depends on props or async data, pass a function that creates it. The hook reads it in a tracked scope, the way a memo does, and owns every actor it returns: when the function returns a new actor, the old one is stopped and the new one started, and the snapshot follows the current actor.

```tsx
function Upload(props: { fileId: string }) {
  const [snapshot, send, actorRef] = useActor(() =>
    createActor(uploadMachine, { input: { fileId: props.fileId } })
  );
  // actorRef is an accessor here: actorRef()
}
```

A new `fileId` starts a fresh actor with fresh state. To keep the state and react to the change, create the actor without the prop and send an event instead.

To follow an actor without owning it, such as one from props or context, use [`fromActorRef(...)`](selectors.md).

## Lifecycle

The actor is created when the hook runs, started once the owner settles, and stopped when the owner is cleaned up. A derived actor is also stopped when it is replaced.

- The initial snapshot is readable before mount, so the first render is never empty.
- Events sent before mount are queued in the actor's mailbox and processed once it starts.
- On cleanup the actor is stopped: invoked children stop, delayed transitions are cancelled and further events are ignored.
- Like any Solid 2 write, a transition reaches the snapshot when Solid flushes, on the next microtask. A read right after `send(...)` outside a reactive scope still sees the previous snapshot; call `flush()` from `solid-js` first when you need it immediately, as in a test.

State does not survive unmount. Persist the snapshot if the actor should resume later. See [Input and restored snapshots](input-and-snapshots.md).

## useActorRef

`useActorRef(logic, options?)` returns only the actor, with the same lifecycle and no reactive snapshot. Given a function, it returns an accessor of the current actor.

```tsx
const actorRef = useActorRef(() =>
  createActor(checkoutMachine, { input: { cartId: props.cartId } })
);
const snapshot = fromActorRef(actorRef);
```

Unlike the Vue package, there is no observer or listener argument. Subscribe to each actor returned by the accessor in an effect, or use [`fromActorRef(...)`](selectors.md).

```tsx
import { createEffect } from 'solid-js';

createEffect(actorRef, (actor) => {
  const subscription = actor.subscribe((snapshot) => {
    // Handle the current actor's snapshot.
  });
  return () => subscription.unsubscribe();
});
```

## useMachine

`useMachine(machine, options?)` is an alias of `useActor(...)` restricted to machine logic, returning the same tuple. New code can use `useActor(...)` for everything.

## TypeScript

Snapshot, event and input types are inferred from the logic. Type a prop that carries an actor with `ActorRefFrom`:

```tsx
import type { ActorRefFrom } from 'xstate';

function Total(props: { actorRef: ActorRefFrom<typeof checkoutMachine> }) {
  const snapshot = fromActorRef(() => props.actorRef);
  return <output>{snapshot().context.total}</output>;
}
```

## Solid primitives cheatsheet

```ts
const [snapshot, send, actorRef] = useActor(logic, options);
const [snapshot, send, actorRef] = useActor(() => createActor(logic, options)); // actorRef is an Accessor
const actorRef = useActorRef(logic, options);
const actorRef = useActorRef(() => createActor(logic, options)); // Accessor
const snapshot = fromActorRef(actorRef); // Accessor
const [snapshot, send, actorRef] = useMachine(machine, options); // alias
```
