# @xstate/effect

Combine XState's event-driven workflows with Effect services, scopes, clocks and tracing.

- Model approval, cancellation, deadlines and retry as explicit states and events.
- Invoke Effect tasks when their result determines the next state.
- Provide services once for the actor and its child logic.
- Keep actor lifetime inside your Effect application.

This package is experimental. It targets XState v6 alpha and Effect 4.

## Installation

<!-- package name and peer dependencies from package.json -->

```bash
npm install @xstate/effect@alpha xstate@alpha effect@^4
```

## XState Effect: Quick start

<!-- public API from src/index.ts; actor lifetime from src/createEffectActor.ts -->

A release waits for approval, expires after 30 seconds, and allows cancellation during deployment. A failed deployment waits for an explicit retry:

<!-- example from examples/effect-workflows/src/approval.ts -->

```ts
import { Context, Effect, Schema } from 'effect';
import {
  createEffectActor,
  fromEffect,
  send,
  setupEffect,
  waitFor
} from '@xstate/effect';

export class Deployments extends Context.Service<
  Deployments,
  { readonly deploy: (release: string) => Effect.Effect<string, Error> }
>()('@app/Deployments') {}

const deploy = fromEffect({
  schemas: { input: Schema.Struct({ release: Schema.String }) },
  effect: ({ input }) => Deployments.use((api) => api.deploy(input.release))
});

export const approvalMachine = setupEffect({
  schemas: { input: Schema.Struct({ release: Schema.String }) },
  actors: { deploy }
}).createMachine({
  context: ({ input }) => ({ release: input.release, url: '' }),
  initial: 'awaitingApproval',
  states: {
    awaitingApproval: {
      after: { 30000: { target: 'expired' } },
      on: {
        APPROVE: { target: 'deploying' },
        CANCEL: { target: 'cancelled' }
      }
    },
    deploying: {
      invoke: {
        src: 'deploy',
        input: ({ context }) => ({ release: context.release }),
        onDone: ({ context, event }) => ({
          target: 'deployed',
          context: { ...context, url: event.output }
        }),
        onError: { target: 'failed' }
      },
      on: { CANCEL: { target: 'cancelled' } }
    },
    failed: {
      on: {
        RETRY: { target: 'deploying' },
        CANCEL: { target: 'cancelled' }
      }
    },
    deployed: { type: 'final' },
    expired: { type: 'final' },
    cancelled: { type: 'final' }
  }
});

export const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(approvalMachine, {
    input: { release: 'v1.2.0' }
  });
  // A UI, webhook or CLI can send this event after a person approves.
  yield* send(actor, { type: 'APPROVE' });
  const snapshot = yield* waitFor(actor, (s) => s.matches('deployed'), {
    timeout: '5 seconds'
  });
  return snapshot.context.url;
});

export const result = await Effect.runPromise(
  program.pipe(
    Effect.scoped,
    Effect.provideService(Deployments, {
      // Replace this demo service with your deployment API.
      deploy: (release) => Effect.succeed(`https://example.com/${release}`)
    })
  )
);
console.log(result); // 'https://example.com/v1.2.0'
```

The demo service runs locally. Replace it with your deployment API. The machine defines which events are valid in each state; Effect provides the deployment service and owns the actor's lifetime.

Start Effect-backed logic with `createEffectActor` inside an Effect scope.

<details>
<summary>Runtime and cancellation details</summary>

- `createEffectActor` runs pure XState transitions from an Effect fiber. Its mailbox processes events in order; timers use Effect's `Clock`.
- Events are processed asynchronously. Read their outcomes with `waitFor`, `join` or `snapshots`.
- Starting Effect-backed logic with XState's `createActor` produces an error because the Effect host is missing.
- Leaving an invoking state interrupts its local Effect. It does not undo work already accepted by an external API; model cancellation or rollback explicitly when needed.

</details>

## Guides

| Guide | Examples |
| --- | --- |
| [Quick start](docs/quick-start.md) | Release approval, expiry, cancellation and retry. |
| [Actors](docs/actors.md) | Share an actor through a Layer and ManagedRuntime. |
| [Observing actors](docs/observing-actors.md) | Snapshot history, output and streamed reminders. |
| [Matching states](docs/matching-states.md) | Exhaustive matching and per-state context. |
| [Effect actor logic](docs/effect-logic.md) | Report tasks, upload progress and rollout health events. |
| [Schemas and actions](docs/schemas-and-actions.md) | Runtime event validation and background audit entries. |
| [Atoms and React](docs/atoms-and-react.md) | Registry ownership, approval controls and useSelector. |
| [Testing and errors](docs/testing-and-errors.md) | TestClock, task retries, supervision and typed failures. |

Runnable copies live in [examples/effect-workflows](../../examples/effect-workflows). Their tests verify the docs use the same code.

## Actors

The actor stops and interrupts its hosted Effects when its enclosing scope closes. Use `Effect.scoped` for a bounded program, or `Layer.effect` to share an actor for an application's lifetime.

- Invoked Effect tasks and streams own their resources and release them on completion, failure or cancellation.
- Background actions use the owning actor's scope.
- Use `withActorScope` around resource acquisition to keep a resource until the owning actor stops.

Provide Layers outside the actor's scope, so services remain available during cleanup. Dispose a `ManagedRuntime` when its owner shuts down. See [actors](docs/actors.md).

### Requirements

`RequirementsFrom<TLogic>` collects services from declared Effect actions, declared actors and inline invocations, including child machines up to 10 levels deep. `createEffectActor` returns `Effect<EffectActor<TLogic>, never, R | Scope>`. Provided action and actor overrides update that service union. Actor and invocation scopes are supplied automatically.

<details>
<summary>Requirement limits</summary>

Deeper requirements are not inferred. Provide them explicitly or flatten the machine tree. Inline spawned Effect logic is rejected; register it in `actors` before spawning it.

The actor's later errors are observed through `join` or snapshots. Invalid input rejected during creation is a defect.

</details>

### Observing actors

<!-- actor surface from src/actor.ts -->

| Function | Use |
| --- | --- |
| `send` | Enqueue an event. |
| `snapshots` | Stream the current snapshot and changes. |
| `waitFor` | Await a snapshot predicate, optionally with a timeout. |
| `join` | Await final output or failure. |
| `emitted` | Stream notifications emitted by the actor. |
| `inspect` | Stream system inspection events. |
| `deadLetters` | Observe delivery failures. |

`send` and `waitFor` support direct and pipeable usage. See [complete observation examples](docs/observing-actors.md).

### Matching states

<!-- tagged state view from src/state.ts -->

`taggedState(snapshot)` exposes `_tag`, `value`, `context` and `snapshot`. Use `TaggedState<typeof machine>` with Effect's `Match.tag` and `Match.exhaustive`. Per-state context narrows with the tag. See [matching states](docs/matching-states.md).

## Effect actor logic

<!-- fromEffect, fromEffectStream, fromEffectEventStream from src/fromEffect.ts -->

| Function | Behavior |
| --- | --- |
| `fromEffect` | Run a task; its success value is the actor's output. |
| `fromEffectStream` | Expose the latest stream item as snapshot context. |
| `fromEffectEventStream` | Relay stream items to the parent as events. |

For example, a progress stream can feed an upload UI:

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

See [Effect actor logic](docs/effect-logic.md) for tasks and a stream that drives rollout transitions.

## Schemas and actions

<!-- schema conversion from src/schema.ts -->

`setupEffect` accepts Effect schemas for input, context, events, output and per-state context. Types are inferred without manual conversion. Add `standardSchemaValidator()` from `xstate/validation` for runtime checks.

### Declared only

<!-- effect action contract from src/setupEffect.ts; spawn guard from src/internal.ts -->

- Register background Effect actions in `setupEffect({ actions })`; enqueue them with explicit arguments.
- Invoke `fromEffect` logic when the machine needs to wait for a result.
- Register spawned Effect logic in `actors`, then use `enq.spawn(args.actors.worker)`.

See [schemas and actions](docs/schemas-and-actions.md) for a complete audit example, runtime schema constraints and inline-source pitfalls.

## Atoms and React

<!-- atom surface from src/atom.ts -->

`createActorAtoms` from `@xstate/effect/atom` exposes `actor`, `snapshot`, `result`, `send`, `select` and `state`. Its `Atom.runtime` must provide the logic's services. Pass `{ input }` when the logic requires input; missing or mismatched input is a type error.

- Read atoms with `@effect/atom-react` in React, or an `AtomRegistry` elsewhere.
- The registry owns their lifetime; dispose it when its owner shuts down.
- `useSelector` from `@xstate/react` can also read an existing `EffectActor` directly.

See [atoms and React](docs/atoms-and-react.md) for complete examples with imports, runtime setup and cleanup.

## Testing and errors

<!-- error types from src/errors.ts; timeout failure from src/actor.ts -->

- Use `TestClock` to drive deadlines without waiting for real time.
- `ActorStoppedError` reports a stop before an awaited result.
- `EffectInterruptedError` reports self-interruption inside Effect logic.
- Timed waits fail with Effect's `Cause.TimeoutError`.
- `join` preserves a task's typed failure. Unexpected machine errors have type `unknown`.

See [testing and errors](docs/testing-and-errors.md) for executable deadline, retry and failure examples. Persisted snapshots record actor state; pass one to `createEffectActor(logic, { snapshot })` to resume the actor. See [persisting and restoring](docs/actors.md#persisting-and-restoring).

## Tracing

<!-- span names and attributes from src/internal.ts and src/fromEffect.ts -->

Hosted work uses spans named `fromEffect`, `fromEffectStream`, `fromEffectEventStream` and `action.<name>`. Each carries `xstate.actor.id` and `xstate.actor.address`. Provide a `Tracer` to record and export them.
