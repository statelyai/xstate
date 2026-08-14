---
title: Durable execution
description: Run pure XState transitions on a durable host.
---

Import the experimental durable execution helper from `xstate/durable` when a
workflow platform owns persistence, retries, timers, messaging and child
execution.

This is for hosts that durably replay or checkpoint the execution loop. If your
application instead restores an actor for each request, processes one event and
saves its snapshot, use the [backend workflow](backend-workflows.md) pattern.

```ts
import { createDurable } from 'xstate/durable';

const durable = createDurable(machine, {
  executeAction: (action, { id }, runtime) =>
    host.runAction(id, () => action.exec(runtime)),
  runtime: ({ id: effectId }, effect) => ({
    sendEvent: (_source, target, event) =>
      host.send(effectId, target.id, event),
    scheduleTimer: (source, id, delay) =>
      host.schedule({ effectId, actorId: source.id, timerId: id, delay }),
    cancelTimer: (source, id) =>
      host.cancelTimer({ effectId, actorId: source.id, timerId: id })
    // Map the remaining ActorSystemRuntime operations supported by the host.
  }),
  waitForEvent: ({ id }) => host.waitForEvent(id)
});

const output = await durable.run(input);
```

`run()` is convenience over the explicit transition loop:

```ts
let [state, effects] = durable.initialTransition(input);
await durable.executeEffects(effects);

while (state.status === 'active') {
  const event = await durable.waitForEvent();
  [state, effects] = durable.transition(state, event);
  await durable.executeEffects(effects);
}
```

`initialTransition()` and `transition()` remain pure. The helper tags their
ordered effects with stable IDs such as `0:0` and `1:0`, and event waits with
IDs such as `event:0`. A durable host should memoize or deduplicate each
operation using that ID. This applies to every operation returned by
`runtime()`, not only custom actions: raw I/O in a runtime method repeats when
the host replays the execution. Replaying the same events from the beginning
reconstructs the same snapshots, effects, waits and IDs.

The host runtime subsumes the local actor system. XState calculates transitions
and stable operation IDs; the adapter maps those operations to durable host
primitives:

- Actions run through `executeAction()` with their stable effect ID and the
  runtime returned by `runtime()`. External work should use the effect ID as an
  idempotency key. A host may require actions to have registered `type` values
  when its activity model cannot replay inline code.
- Sends route through the host's actor or workflow identity.
- Timers register host-managed delivery and return immediately. The host stamps
  `dueAt` when it durably commits the timer; transition calculation never reads
  wall-clock time.
- Invoked or spawned actors use host child-workflow facilities when available.
- Unsupported runtime operations throw.

Custom actions are dispatched separately from actor-system effects. This keeps
host operations such as timers and child workflows visible to runtimes that do
not permit durable operations to be nested inside a generic activity. Both
callbacks receive the complete effect metadata. `runtime()` creates the host
runtime and receives the complete effect; `executeAction()` receives that
runtime when it executes the action.

`run()` resolves with the machine output when the machine is done, throws the
machine error when it fails, and throws `DurableExecutionCancelledError` when
it stops. It only starts fresh executions. A nonzero `nextTransitionIndex`, or
calling a lower-level transition method before `run()`, causes
`DurableExecutionResumeError`; resume with the persisted snapshot and the
explicit transition loop instead.

The helper does not prescribe storage, inboxes, retries or timer
implementations. Hosts that restore from checkpoints instead of replaying from
the beginning should persist `durable.nextTransitionIndex` after every
transition, including transitions with no effects, and pass it as
`nextTransitionIndex` when recreating the durable execution.

## Host adapters

Experimental adapters provide the common loop without hiding host-specific
semantics:

```ts
import { createDurable } from '@xstate/inngest';

const output = await createDurable(machine, {
  step,
  event: 'machine/event',
  timeout: '30 days',
  if: 'async.data.actorId == event.data.actorId',
  runtime: ({ id }, effect) => host.runtimeFor(id, effect)
}).run(input);
```

`@xstate/inngest` maps actions and event waits to Inngest steps.
`@xstate/rivet` maps actions to workflow steps and uses a Rivet queue as the
inbox. Both expose `create…Adapter()` for the explicit transition loop and pass
the complete effect to `runtime` so the application can map timers, sends and
child actors without coupling XState core to either host.

An Inngest event-wait timeout throws `InngestEventWaitTimeoutError`; it does not
become a machine event. Catch and translate it outside `run()` if the machine
should handle timeout as domain input.

These adapters deliberately do not approximate missing host semantics. For
example, awaiting a sleep inline cannot implement a cancellable timer while
also receiving intervening events. Such operations require a host-native
timer/inbox mapping; an unmapped operation throws.

## Adapter contract tests

Official adapters keep fast context-contract tests in this monorepo. They use
small host doubles and run in the normal CI suite, verifying stable IDs, action
execution, waits, outputs, errors and runtime-effect mapping without starting
vendor infrastructure. Unsupported mailbox, timer or child-actor semantics
remain explicit gaps.

Third-party adapters can use `@xstate/durable-test` to register the same
capability-based Vitest conformance suite against their own host harness.

## What next?

- [Run backend workflows](backend-workflows.md) when your application owns
  snapshot storage and restores an actor per request.
- [Persistence](persistence.md) for snapshot versioning, migration and event
  adaptation.
