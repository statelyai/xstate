---
title: Matching states
description: View a machine snapshot as a tagged union.
---

`taggedState(snapshot)` views a machine snapshot as a member of a tagged union, so `Match.tag` and `Match.exhaustive` work on states.

The returned value has four fields:

| Field | Description |
| --- | --- |
| `_tag` | The state's dotted path, such as `'checkout.paying'`. |
| `value` | The snapshot's state value. |
| `context` | That state's context, including any per-state context schema. |
| `snapshot` | The snapshot itself. |

`TaggedState<typeof machine>` names the union for a machine. `TaggedStateFrom<TSnapshot>` names it for a snapshot type. `StateTag<TValue>` is the tag of a single state value.

```ts
import { Match, Stream } from 'effect';
import { snapshots, taggedState, type TaggedState } from '@xstate/effect';

const describe = Match.type<TaggedState<typeof checkoutMachine>>().pipe(
  Match.tag('cart', ({ context }) => `${context.items.length} items`),
  Match.tag('paying', ({ context }) => `paying ${context.paymentId}`),
  Match.tag('done.paid', 'done.declined', ({ _tag }) => _tag),
  Match.exhaustive
);

const labels = snapshots(actor).pipe(
  Stream.map(taggedState),
  Stream.map(describe)
);
```

Because `context` is the context of that state, a per-state context schema declared in `setupEffect({ states })` narrows with the tag. See [schemas and actions](schemas-and-actions.md).

## Parallel states

A [parallel state](../parallel-states.md) is in several regions at once, so it has no single dotted path. Its tag stops at the parallel state, and is `'(machine)'` when the machine itself is parallel. Match on `value` or `snapshot.matches` for the regions of a parallel state.

```ts
const region = Match.type<TaggedState<typeof parallelMachine>>().pipe(
  Match.tag('(machine)', ({ snapshot }) =>
    snapshot.matches({ upload: 'sending' }) ? 'sending' : 'idle'
  ),
  Match.exhaustive
);
```

## The `state` atom

`createActorAtoms` exposes the same view as its `state` atom, so a UI can match on states without calling `taggedState` itself. See [atoms and React](atoms-and-react.md).
