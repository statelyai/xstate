---
title: "XState Effect: Actor logic"
description: Use Effect tasks and streams as parts of an event-driven workflow.
---

Turn an Effect or Stream into [actor logic](../../../docs/actor-logic.md) with one of these functions. Start it with `createEffectActor`, or invoke it from a machine running under `createEffectActor`.

| Function | Use it for |
| --- | --- |
| `fromEffect` | A task whose result decides the next state. |
| `fromEffectStream` | A changing value, such as upload progress. |
| `fromEffectEventStream` | Events that drive a workflow, such as health checks. |

Each accepts a value, a function of actor arguments that returns the value, or a configuration object with `id`, `schemas`, `validator` and `effect` or `stream`.

## `fromEffect`

Use `fromEffect` for work the machine waits for: publishing a release, reserving inventory or building a report. The [quick start](quick-start.md) invokes a deployment task and handles success, failure and cancellation.

Here is a complete task with typed input and output:

<!-- example from examples/effect-workflows/src/task.ts -->

```ts
import { Effect, Schema } from 'effect';
import { createEffectActor, fromEffect, join } from '@xstate/effect';

const buildReport = fromEffect({
  schemas: { input: Schema.Struct({ orderIds: Schema.Array(Schema.String) }) },
  effect: ({ input, emit }) =>
    Effect.sync(() => {
      emit({ type: 'reportBuilt', count: input.orderIds.length });
      return { total: input.orderIds.length };
    })
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(buildReport, {
    input: { orderIds: ['order-1', 'order-2'] }
  });
  return yield* join(actor);
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // { total: 2 }
```

- The actor is `active` while the Effect runs.
- Success puts it in `done` and stores the value in `output`.
- Failure puts it in `error`; `join` and an invoking machine's `onError` receive the typed error.
- The task actor has no context of its own.

### Actor arguments

The function form receives `EffectSourceArgs<TInput>` once per actor start:

| Field | Description |
| --- | --- |
| `input` | The actor's input. |
| `self` | The actor's reference. |
| `system` | The actor system. |
| `emit` | Emits a notification for `actor.on(...)` and `emitted(actor)`. |

Input and output schemas are optional. Missing types are inferred from the function or Effect. See [schemas and actions](schemas-and-actions.md) for runtime validation.

### Cancellation and failure

Leaving an invoking state or stopping the actor interrupts the running Effect. Each task runs in its own scope:

- `Effect.acquireRelease` and `Effect.addFinalizer` clean up before a completed or failed task reports its outcome.
- Cancelling an invocation interrupts the task and runs its cleanup while the parent can continue in another state.
- Use `withActorScope` for resources that should stay open until the owning actor stops. See [resource lifetimes](actors.md#resource-lifetimes).

Use Effect's retry and timeout combinators inside the task.

<details>
<summary>How Effect exits map to actors</summary>

| Exit | Actor result |
| --- | --- |
| Success | `done`, with the success value as `output`. |
| Typed failure | `error`, with the failure value as `error`. |
| Defect | `error`, with the squashed cause. |
| Interrupted because the actor stopped or the invoking state exited | Stopped, without an error. |
| Self-interruption inside the Effect | `error`, with `EffectInterruptedError`. |

`Effect.timeout` fails with `Cause.TimeoutError`. A lost `Effect.race` interrupts only the loser; the actor completes with the winner.

</details>

## `fromEffectStream`

Use `fromEffectStream` when consumers need the latest value. For example, upload progress becomes the actor's snapshot context:

<!-- example from examples/effect-workflows/src/latest-stream.ts -->

```ts
import { Effect, Option, Stream } from 'effect';
import { createEffectActor, fromEffectStream, snapshots } from '@xstate/effect';

// Demo upload progress. Replace with your upload SDK's progress stream.
const uploadProgress = fromEffectStream(Stream.make(0, 25, 60, 100));

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(uploadProgress);
  return yield* snapshots(actor).pipe(
    Stream.filter((s) => s.context !== undefined),
    Stream.map((s) => s.context),
    Stream.runLast,
    Effect.map(Option.getOrThrow)
  );
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 100
```

The demo stream is finite. Replace it with your upload SDK's progress stream; the actor exposes each new percentage as `snapshot.context`.

- Context is `undefined` until the first item arrives.
- Completion puts the actor in `done`, with no output; the last context remains readable.
- Stream failure puts the actor in `error`.
- Read changing values with `snapshots`, `waitFor` or a UI selector.

## `fromEffectEventStream`

Use `fromEffectEventStream` when stream items should trigger transitions. This deployment feed first reports a healthy rollout, then a health failure that requests rollback:

<!-- example from examples/effect-workflows/src/event-stream.ts -->

```ts
import { Effect, Stream } from 'effect';
import {
  createEffectActor,
  fromEffectEventStream,
  join,
  setupEffect
} from '@xstate/effect';

// A deployment feed drives the workflow, rather than just displaying data.
const deploymentEvents = fromEffectEventStream(
  Stream.make({ type: 'HEALTHY' }, { type: 'UNHEALTHY' })
);

const rolloutMachine = setupEffect({
  actors: { deploymentEvents }
}).createMachine({
  output: () => 'rollback requested',
  initial: 'monitoring',
  states: {
    monitoring: {
      invoke: { src: 'deploymentEvents' },
      initial: 'checking',
      states: {
        checking: { on: { HEALTHY: { target: 'healthy' } } },
        healthy: {}
      },
      on: { UNHEALTHY: { target: 'rollingBack' } }
    },
    rollingBack: { type: 'final' }
  }
});

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(rolloutMachine);
  return yield* join(actor);
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'rollback requested'
```

The stream belongs to `monitoring`, so it stays active when that state moves from `checking` to `healthy`. Leaving `monitoring` stops the stream actor and interrupts its consumption.

- Each item is relayed to the parent machine as an event.
- Completion puts the stream actor in `done`, with no output.
- Stream failure puts it in `error`; handle it with the invocation's `onError`.

Use this pattern for WebSocket messages, job updates or subscription feeds that change a workflow's state.

## Tracing

The three functions run inside spans named `fromEffect`, `fromEffectStream` and `fromEffectEventStream`. See [tracing](testing-and-errors.md#tracing).
