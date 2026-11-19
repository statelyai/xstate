---
title: Input and restored snapshots
description: Start Solid actors with input or a persisted snapshot.
---

Pass `input` as an actor option for a new actor. To resume a persisted actor, create it with `restoreActor(...)` from `xstate/persist`, then pass that actor to `useActor(...)`, `useMachine(...)` or `useActorRef(...)`.

```ts
const [snapshot, send] = useActor(checkoutMachine, { input: { cartId } });

const [resumed] = useActor(restoreActor(checkoutMachine, persistedSnapshot));
```

`input` creates a fresh initial state from data the actor needs when it starts. `restoreActor` resumes an actor that already ran. When either depends on props or async data, pass a function that creates the actor instead (see below).

## Input from props

```tsx
import { createActor } from 'xstate';

function Checkout(props: { cartId: string }) {
  const [snapshot, send] = useActor(() =>
    createActor(checkoutMachine, { input: { cartId: props.cartId } })
  );
  // ...
}
```

The function is read like a memo, so `props.cartId` is read where it is needed rather than in the component body. The hook owns the actors it returns: a new `cartId` stops the old actor and starts a new one with fresh state. If the state should survive the change, model it in the machine instead and send it as an event, for example `cart.changed`.

Machines that declare required [input](../input-output.md) make the options argument mandatory in TypeScript.

## Persisting a snapshot

`actorRef.getPersistedSnapshot()` returns a serializable value, including persisted children. Save it as the actor changes.

```tsx
import { onSettled } from 'solid-js';
import { useActor } from '@xstate/solid';
import { createActor } from 'xstate';
import { restoreActor } from 'xstate/persist';

function createUploadActor() {
  const persisted = loadSnapshot();
  const restored = persisted ? restoreActor(uploadMachine, persisted) : undefined;
  return !restored || restored.getSnapshot().status === 'error'
    ? createActor(uploadMachine)
    : restored;
}

function UploadPanel() {
  const [snapshot, send, actorRef] = useActor(createUploadActor());

  onSettled(() => {
    const persist = () => {
      localStorage.setItem(
        'upload',
        JSON.stringify(actorRef.getPersistedSnapshot())
      );
    };
    const subscription = actorRef.subscribe(persist);
    persist();
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
useActor(() => restoreActor(logic, persistedAsync())); // waits under <Loading>
useActorRef(restoreActor(logic, persisted));

actorRef.getPersistedSnapshot();
```
