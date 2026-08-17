---
title: States
description: Define state nodes and read machine snapshots.
---

State nodes are values in a machine's `states` object.

```ts
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {},
    active: {},
    complete: { type: 'final' }
  }
});
```

## State node types

- Atomic states have no children.
- Compound states have children and one active child at a time.
- [Parallel states](parallel-states.md) activate every child region at once.
- [Final states](final-states.md) complete their parent and can produce [output](input-output.md).
- [History states](history-states.md) remember the previously active child.
- [Choice states](choice-states.md) resolve to a target instead of resting.

See [machine configuration](configuration.md) for every property a state node accepts.

## State snapshots

`actor.getSnapshot()` returns a machine snapshot: an immutable description of the machine at one point in time.

| Member | Type | Description |
| --- | --- | --- |
| `value` | `string` or nested object | The active state value. |
| `context` | `object` | Current [context](context.md). |
| `status` | `'active' \| 'done' \| 'error' \| 'stopped'` | Snapshot [status](snapshots.md). |
| `children` | `Record<string, ActorRef>` | Invoked and [spawned](spawn.md) child actors, keyed by id. |
| `output` | output type or `undefined` | Machine [output](input-output.md); only set when `status` is `'done'`. |
| `error` | `unknown` | Only set when `status` is `'error'`. |
| `tags` | `Set<string>` | Tags of all active state nodes. |
| `nodes` | `StateNode[]` | Active state nodes represented by `value`. |
| `historyValue` | `object` | Remembered values for [history states](history-states.md). |
| `timers` | `Record<string, LogicalTimer>` | Pending [delayed](delays.md) and [timeout](timeouts.md) timers. |
| `machine` | `StateMachine` | The machine that produced this snapshot. |

| Method | Returns | Description |
| --- | --- | --- |
| `matches(partialValue)` | `boolean` | Whether the state value matches a partial value. Narrows the snapshot type. |
| `can(event)` | `boolean` | Whether the event would take a non-forbidden transition. |
| `hasTag(tag)` | `boolean` | Whether any active state node has the tag. |
| `getMeta()` | `Record<stateId, meta>` | Metadata of active state nodes. |
| `getInputs()` | `Record<stateId, input>` | [State input](state-input.md) of active state nodes. |
| `toJSON()` | `object` | Serializable form, with `tags` as an array. See [serialization](serialization.md). |

## Matching state values

`matches(...)` accepts a partial state value. A parent match succeeds no matter which child is active.

```ts
snapshot.matches('active');
snapshot.matches({ checkout: 'payment' });
snapshot.matches({ checkout: { payment: 'authorizing' } });
```

For [parallel states](parallel-states.md), pass only the regions to check. Unlisted regions are ignored.

```ts
// value: { player: { playback: 'playing', volume: 'muted' } }
snapshot.matches({ player: { playback: 'playing' } }); // true
```

`matches(...)` narrows the snapshot type, so context that only exists in that state becomes available inside the branch.

## Checking events

`can(...)` answers whether sending an event right now would select a transition that is not forbidden, even if that transition has no actions and does not change the state value.

```ts
snapshot.can({ type: 'submit' });
```

Because v6 conditions live inside transition functions, `can(...)` calls those functions to see whether they return a transition. It does not execute their effects: enqueued actions, raised events and sent events are discarded. Keep transition functions free of side effects outside `enq(...)` so that `can(...)` stays safe to call during rendering.

A checkout button can be disabled with `can({ type: 'submit' })` instead of duplicating the machine's rules.

## Tags

Tags label states that share a meaning. Declare them per state node, and their type with `schemas.tags`.

```ts
const machine = createMachine({
  schemas: { tags: z.enum(['busy', 'error']) },
  initial: 'idle',
  states: {
    idle: {},
    uploading: { tags: ['busy'] },
    processing: { tags: ['busy'] }
  }
});

snapshot.hasTag('busy');
snapshot.tags; // Set { 'busy' }
```

`uploading` and `processing` can both render the same spinner without the view knowing either state name.

## Metadata

`meta` attaches static data to a state node. `getMeta()` returns the metadata of every active state node, keyed by state node id.

```ts
const machine = createMachine({
  id: 'upload',
  schemas: { meta: z.object({ label: z.string() }) },
  initial: 'selecting',
  states: {
    selecting: { meta: { label: 'Choose a file' } },
    uploading: { meta: { label: 'Uploading…' } }
  }
});

snapshot.getMeta(); // { 'upload.uploading': { label: 'Uploading…' } }
```

State nodes without `meta` are omitted. Metadata must match `schemas.meta`.

## TypeScript

Literal state keys are inferred from the machine configuration, so `matches(...)` rejects unknown values. Use `SnapshotFrom<typeof machine>` for the snapshot type.

```ts
import type { SnapshotFrom } from 'xstate';

type UploadSnapshot = SnapshotFrom<typeof machine>;
```

## States cheatsheet

```ts
snapshot.value;
snapshot.context;
snapshot.status;
snapshot.children;
snapshot.output;
snapshot.error;
snapshot.matches('idle');
snapshot.matches({ loading: 'user' });
snapshot.can({ type: 'submit' });
snapshot.hasTag('busy');
snapshot.getMeta();
snapshot.getInputs();
snapshot.toJSON();
```
