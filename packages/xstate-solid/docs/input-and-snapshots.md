---
title: Input and restored snapshots
description: Start Solid actors with input or a persisted snapshot.
---

`input` and `snapshot` are actor options, so they are passed as the second argument to `useActor(...)`, `useMachine(...)` or `useActorRef(...)`.

```ts
const [snapshot, send] = useActor(checkoutMachine, {
  input: { cartId: props.cartId },
  snapshot: restoredSnapshot
});
```

`input` creates a fresh initial state from data the actor needs when it starts. A persisted `snapshot` resumes an actor that already ran. Both are read once, when the component function runs.

## Input from props

```tsx
function Checkout(props: { cartId: string }) {
  const [snapshot, send] = useActor(checkoutMachine, {
    input: { cartId: props.cartId }
  });
  // ...
}
```

Reading `props.cartId` here is a one-time read: a Solid component function runs once, so a later prop change does not restart the actor. Choose one of:

- send an event, such as `send({ type: 'cart.changed', cartId: props.cartId })` from a `createEffect(...)`, and model the change in the machine
- recreate the component with a keyed boundary, such as `<Show when={props.cartId} keyed>`, so the old actor is stopped and a new one is created

Machines that declare required [input](../input-output.md) make the options argument mandatory in TypeScript.

## Persisting a snapshot

`actorRef.getPersistedSnapshot()` returns a serializable value, including persisted children. Save it as the actor changes.

```tsx
import { onCleanup } from 'solid-js';
import { useActor } from '@xstate/solid';

function UploadPanel() {
  const [snapshot, send, actorRef] = useActor(uploadMachine, {
    snapshot: loadSnapshot()
  });

  const subscription = actorRef.subscribe(() => {
    localStorage.setItem(
      'upload',
      JSON.stringify(actorRef.getPersistedSnapshot())
    );
  });

  onCleanup(() => subscription.unsubscribe());

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
useActor(logic, { snapshot: persisted });
useActorRef(logic, { input, snapshot });

actorRef.getPersistedSnapshot();
```
