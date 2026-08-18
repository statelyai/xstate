---
title: Persist and restore actors
description: Save an actor's state as it changes and restore it on the next visit.
---

This guide keeps a checkout actor alive across page reloads. It saves on every change, restores on startup, and discards stored state it cannot use.

## 1. Save the snapshot when it changes

`actor.getPersistedSnapshot()` returns a serializable value that includes persisted child actors. Subscribe to the actor and write it out.

Writing on every snapshot is wasteful, so debounce the write with a timer.

```ts
import { Actor, createActor } from 'xstate';

const STORAGE_KEY = 'checkout';
const VERSION = '2';

function saveOnChange(actor: Actor<typeof checkoutMachine>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const subscription = actor.subscribe(() => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: VERSION,
          snapshot: actor.getPersistedSnapshot()
        })
      );
    }, 250);
  });

  return () => {
    clearTimeout(timeout);
    subscription.unsubscribe();
  };
}
```

The version stamp is written alongside the snapshot, not inside it. The next step uses it to decide whether the stored data still fits the machine.

## 2. Read and validate what was stored

Stored data is untrusted input. It may be missing, truncated, written by an older build, or edited by hand.

Validate it before restoring: parse inside `try`, then check the version. Return `undefined` when anything does not fit.

```ts
function loadSnapshot() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) return undefined;

  try {
    const { version, snapshot } = JSON.parse(stored);

    if (version !== VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }

    return snapshot;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
}
```

> **Warning:** Validate before restoring. `createActor(...)` does not reject a malformed snapshot with a catchable error; it starts an actor in an unusable state.

## 3. Restore on startup

Pass the snapshot to `createActor(...)` with the `snapshot` option. When there is nothing to restore, the actor starts from its initial state.

```ts
const checkout = createActor(checkoutMachine, {
  snapshot: loadSnapshot()
}).start();

const stopSaving = saveOnChange(checkout);
```

Clear the stored value when the flow finishes, so a completed checkout does not come back on the next visit.

```ts
checkout.subscribe((snapshot) => {
  if (snapshot.status === 'done') {
    localStorage.removeItem(STORAGE_KEY);
  }
});
```

## 4. Keep old snapshots working

Discarding an old snapshot is the right default for a cart or a wizard. When users must not lose their place, migrate instead of discarding: register the machine versions you retain and convert stored snapshots to the current one with [`machineVersions(...)`](persistence.md#migrate-machine-versions).

Two rules apply to either choice:

- Bump the version whenever states, context or child actor logic change.
- Keep live resources out of context. Database clients, sockets and DOM nodes do not serialize. Store an ID and look the resource up again after restoring.

## On the server

The same two calls work outside the browser: read a snapshot from your database instead of `localStorage`, and save it back after handling a request. A server actor usually lives for one request, so save once at the end rather than on every change. See [run backend workflows](backend-workflows.md).

## What next?

- [Persistence](persistence.md) for the full API, snapshot migration and event adaptation.
- [Run backend workflows](backend-workflows.md) to resume a workflow per request.
- [Serialization](serialization.md) for what can be stored in context.
