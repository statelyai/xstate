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

Snapshot status is `active`, `done`, `error` or `stopped`. Machine snapshots also contain `value`, `context`, `children` and helper methods such as `matches(...)` and `can(...)`.

`getSnapshot()` reads the current value without subscribing. `subscribe(...)` observes future snapshots. A subscription created before `start()` receives the initial snapshot.

Use a snapshot to render a checkout step or upload progress. Use `waitFor(...)` in a test or request handler that must wait for `ready` or `done`.

Use `waitFor(...)` when code should wait until a snapshot matches a condition.

```ts
import { waitFor } from 'xstate';

const snapshot = await waitFor(actor, (snapshot) =>
  snapshot.matches('ready')
);
```

## TypeScript

Use `SnapshotFrom` to get the snapshot type for actor logic or an actor reference.

```ts
import type { SnapshotFrom } from 'xstate';

type MachineSnapshot = SnapshotFrom<typeof machine>;
```

## Snapshots cheatsheet

```ts
actor.getSnapshot();
actor.subscribe((snapshot) => console.log(snapshot));
actor.getSnapshot().can({ type: 'submit' });
await waitFor(actor, (snapshot) => snapshot.status === 'done');
```
