---
title: Input and restored snapshots
description: Start Solid actors with input or a persisted snapshot.
---

Pass `input` as an actor option for a new actor. To resume a persisted actor, create it with `restoreActor(...)` from `xstate/persist`, then pass that actor to `useActor(...)`, `useMachine(...)` or `useActorRef(...)`.

```ts
const [snapshot, send] = useActor(checkoutMachine, {
  input: untrack(() => ({ cartId: props.cartId }))
});

const restored = restoreActor(checkoutMachine, persistedSnapshot);
const [resumed] = useActor(restored);
```

`input` creates a fresh initial state from data the actor needs when it starts. `restoreActor` resumes an actor that already ran. Both happen once, when the component function runs, so create the actor once per component instance.

## Input from props

```tsx
import { untrack } from 'solid-js';

function Checkout(props: { cartId: string }) {
  const [snapshot, send] = useActor(checkoutMachine, {
    input: untrack(() => ({ cartId: props.cartId }))
  });
  // ...
}
```

Reading `props.cartId` here is a one-time read: a Solid component function runs once, so a later prop change does not restart the actor. `untrack(...)` marks the read as intended; without it Solid warns in development. Choose one of:

- send an event from an effect, such as `createEffect(() => props.cartId, (cartId) => send({ type: 'cart.changed', cartId }), { defer: true })`, and model the change in the machine
- recreate the component with a keyed boundary, such as `<Show when={props.cartId} keyed>`, so the old actor is stopped and a new one is created

Machines that declare required [input](../input-output.md) make the options argument mandatory in TypeScript.

## Persisting a snapshot

`actorRef.getPersistedSnapshot()` returns a serializable value, including persisted children. Save it as the actor changes.

```tsx
import { onSettled } from 'solid-js';
import { useActor } from '@xstate/solid';
import { createActor } from 'xstate';
import { restoreActor } from 'xstate/persist';

function UploadPanel() {
  const persisted = loadSnapshot();
  const restored = persisted ? restoreActor(uploadMachine, persisted) : undefined;
  const actor =
    !restored || restored.getSnapshot().status === 'error'
      ? createActor(uploadMachine)
      : restored;
  const [snapshot, send, actorRef] = useActor(actor);

  onSettled(() => {
    const subscription = actorRef.subscribe(() => {
      localStorage.setItem(
        'upload',
        JSON.stringify(actorRef.getPersistedSnapshot())
      );
    });
    return () => subscription.unsubscribe();
  });

  return <progress value={snapshot.context.progress} />;
}
```

Read it back before the actor is created:

```ts
function loadSnapshot() {
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem('upload');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
```

The `typeof localStorage` check matters in SolidStart, where component code also runs on the server. Stored snapshots are untrusted input: validate them and fall back to `undefined` when they do not fit the current machine. See [Persist and restore actors](../persist-and-restore-actors.md) for versioning.

## What restoring does

A restored actor starts in the persisted state. Actions that already ran are not re-executed. Invoked actors are restarted and spawned actors are restored recursively, so a machine restored inside `uploading` starts the upload request again. Delayed transitions are rescheduled when the actor starts on mount.

> **Warning:** Do not persist a snapshot that holds values which cannot survive `JSON.stringify`: DOM nodes, file handles, promises. Keep those out of context, or model them as invoked actors that are recreated on restore.

## Cheatsheet

```ts
useActor(logic, { input });
useActor(restoreActor(logic, persisted));
useActorRef(restoreActor(logic, persisted));

actorRef.getPersistedSnapshot();
```
