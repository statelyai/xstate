---
title: Actor snapshots
description: Read and observe actor state.
---

An actor snapshot describes the actor at one point in time.

```ts
const subscription = actor.subscribe((snapshot) => {
  console.log(snapshot.status);
});

actor.start();
subscription.unsubscribe();
```

`getSnapshot()` reads the current snapshot without subscribing. `subscribe(...)` observes future snapshots. A subscription created before `start()` also receives the initial snapshot.

Use a snapshot to render a checkout step or upload progress. Machine snapshots also carry `value`, `context`, `children` and helpers such as `matches(...)` and `can(...)`; see [states](states.md) for the full member list.

## Status

Every snapshot has a `status`.

| Status | Meaning | Set by |
| --- | --- | --- |
| `active` | The actor is running and can receive events. | Creating and starting the actor. |
| `done` | The actor completed. `output` is set. | Reaching a top-level [final state](final-states.md), or the logic resolving. |
| `error` | The actor failed. `error` is set. | An uncaught error in a transition function, action or invoked actor. |
| `stopped` | The actor was stopped before completing. | `actor.stop()`, or its parent stopping it when a state is exited. |

`done`, `error` and `stopped` are terminal: the actor no longer processes events, its children and timers are disposed, and its observers are completed or errored.

```ts
const snapshot = actor.getSnapshot();

if (snapshot.status === 'done') {
  console.log(snapshot.output);
} else if (snapshot.status === 'error') {
  console.error(snapshot.error);
}
```

`output` is only defined for `done` snapshots, and `error` only for `error` snapshots. TypeScript narrows both from `status`.

## Immutability and identity

Snapshots are never mutated. Each transition produces a new snapshot object, so a previously captured snapshot keeps describing the moment it was read.

An event that takes no transition produces no new object: subscribers are still notified, with the same snapshot reference as before.

```ts
const before = actor.getSnapshot();
actor.send({ type: 'unhandled' });
actor.getSnapshot() === before; // true
```

This makes reference equality a valid re-render check in UI bindings. For finer-grained comparisons, use [selectors](selectors.md).

## Waiting for a snapshot

`waitFor(...)` resolves with the first snapshot that satisfies a predicate, including the current one.

```ts
import { waitFor } from 'xstate';

const snapshot = await waitFor(actor, (snapshot) =>
  snapshot.matches('ready')
);
```

| Option | Default | Description |
| --- | --- | --- |
| `timeout` | `Infinity` | Milliseconds before rejecting with a timeout error. |
| `signal` | none | An `AbortSignal` that stops waiting and rejects with the signal's reason. |

```ts
const snapshot = await waitFor(actor, (snapshot) => snapshot.hasTag('loaded'), {
  timeout: 5_000,
  signal: request.signal
});
```

The promise also rejects if the actor errors, or if it terminates without ever satisfying the predicate. Use `waitFor(...)` in a test or a request handler that must block until the machine reaches a state.

To wait for completion instead of a specific state, use [`toPromise(actor)`](utilities.md), which resolves with the actor's [output](input-output.md) and rejects on error.

```ts
import { toPromise } from 'xstate';

const output = await toPromise(actor);
```

## Child snapshots

`snapshot.children` holds the actor's invoked and [spawned](spawn.md) children, keyed by their id. Each child is an actor reference with its own snapshot.

```ts
const upload = actor.getSnapshot().children.upload;

upload?.getSnapshot().context.progress;
```

Children appear while the state that owns them is active and disappear when it is exited, so read them defensively. `getPersistedSnapshot()` includes child state, so a restored actor restores its children too. See [persistence](persistence.md).

## TypeScript

Use `SnapshotFrom` to get the snapshot type for actor logic or an actor reference.

```ts
import type { SnapshotFrom } from 'xstate';

type MachineSnapshot = SnapshotFrom<typeof machine>;
```

## Snapshots cheatsheet

```ts
actor.getSnapshot();
actor.getSnapshot().status;
actor.getSnapshot().output;
actor.getSnapshot().error;
actor.subscribe((snapshot) => console.log(snapshot));
actor.getSnapshot().can({ type: 'submit' });
actor.getSnapshot().children.upload?.getSnapshot();

await waitFor(actor, (snapshot) => snapshot.status === 'done');
await waitFor(actor, (snapshot) => snapshot.matches('ready'), {
  timeout: 5_000
});
await toPromise(actor);
```
