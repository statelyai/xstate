---
title: "XState Effect: Matching states"
description: Render workflow states with exhaustive Effect Match branches.
---

`taggedState(snapshot)` gives a machine snapshot an Effect-style `_tag`. Use `Match.tag` and `Match.exhaustive` to describe every state of a workflow.

In this review example, only the approved state has a `reviewer`. Matching that tag also narrows its context:

<!-- example from examples/effect-workflows/src/matching.ts -->

```ts
import { Effect, Match, Schema, Stream } from 'effect';
import {
  createEffectActor,
  send,
  setupEffect,
  snapshots,
  taggedState,
  type TaggedState
} from '@xstate/effect';

const reviewMachine = setupEffect({
  states: {
    approved: {
      schemas: { context: Schema.Struct({ reviewer: Schema.String }) }
    }
  }
}).createMachine({
  initial: 'pending',
  states: {
    pending: {
      on: { APPROVE: { target: 'approved', context: { reviewer: 'Ada' } } }
    },
    approved: { type: 'final' }
  }
});

const describe = Match.type<TaggedState<typeof reviewMachine>>().pipe(
  Match.tag('pending', () => 'Waiting for review'),
  Match.tag('approved', ({ context }) => `Approved by ${context.reviewer}`),
  Match.exhaustive
);

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(reviewMachine);
  return [
    ...(yield* snapshots(actor).pipe(
      Stream.tap((s) =>
        s.matches('pending') ? send(actor, { type: 'APPROVE' }) : Effect.void
      ),
      Stream.map(taggedState),
      Stream.map(describe),
      Stream.runCollect
    ))
  ];
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // ['Waiting for review', 'Approved by Ada']
```

Adding a state requires adding a matching branch before `Match.exhaustive` will typecheck.

## Tagged state fields

| Field | Description |
| --- | --- |
| `_tag` | The dotted state path, such as `review.approved`. |
| `value` | The XState state value. |
| `context` | The context for that state, including its per-state schema. |
| `snapshot` | The original snapshot. |

- `TaggedState<typeof machine>` names the union for a machine.
- `TaggedStateFrom<TSnapshot>` names it for a snapshot type.
- `StateTag<TValue>` names the tag for one state value.

Declare per-state context with `setupEffect({ states })`. See [schemas and actions](schemas-and-actions.md).

## Parallel states

A parallel workflow can wait for review while building a release. Its `_tag` stops at the parallel state; when the root is parallel, the tag is `'(machine)'`. Inspect `value` or use `snapshot.matches` to read individual regions:

<!-- example from examples/effect-workflows/src/parallel.ts -->

```ts
import { Effect, Match } from 'effect';
import {
  createEffectActor,
  taggedState,
  type TaggedState
} from '@xstate/effect';
import { createMachine } from 'xstate';

const releaseMachine = createMachine({
  type: 'parallel',
  states: {
    review: { initial: 'pending', states: { pending: {}, approved: {} } },
    build: { initial: 'running', states: { running: {}, passed: {} } }
  }
});

const describe = Match.type<TaggedState<typeof releaseMachine>>().pipe(
  Match.tag('(machine)', ({ snapshot }) =>
    snapshot.matches({ build: 'running' })
      ? 'Build in progress'
      : 'Build finished'
  ),
  Match.exhaustive
);

export const result = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const actor = yield* createEffectActor(releaseMachine);
      return describe(taggedState(actor.getSnapshot()));
    })
  )
);
console.log(result); // 'Build in progress'
```

## UI atoms

`createActorAtoms` exposes this same tagged union through its `state` atom. A UI can match on states without calling `taggedState` itself. See [atoms and React](atoms-and-react.md).
