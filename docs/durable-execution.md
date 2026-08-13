---
title: Durable execution
description: Run pure XState transitions on a durable host.
---

Import the experimental durable execution helper from `xstate/durable` when a
workflow platform owns persistence, retries, timers, messaging and child
execution.

```ts
import { createDurable } from 'xstate/durable';

const durable = createDurable(machine, {
  executeAction: (action, { id }) =>
    host.runAction(id, action.type, action.params),
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
operation using that ID. Replaying the same events from the beginning
reconstructs the same snapshots, effects, waits and IDs.

The host runtime subsumes the local actor system:

- Registered actions run as durable steps or activities. Adapters should reject
  inline actions that cannot be identified and restored by `type`.
- Sends route through the host's actor or workflow identity.
- Timers register host-managed delivery and return immediately. The host stamps
  `dueAt` when it durably commits the timer; transition calculation never reads
  wall-clock time.
- Invoked or spawned actors use host child-workflow facilities when available.
- Unsupported runtime operations throw.

Custom actions are dispatched separately from actor-system effects. This keeps
host operations such as timers and child workflows visible to runtimes that do
not permit durable operations to be nested inside a generic activity. The
runtime receives the complete built-in `effect` when it needs registered actor
source, input, event or target data that is not present in the runtime method
arguments.

`run()` resolves with the machine output when the machine is done, throws the
machine error when it fails, and throws `DurableExecutionCancelledError` when
it stops.

The helper does not prescribe storage, inboxes, retries or timer
implementations. Hosts that restore from checkpoints instead of replaying from
the beginning should persist `durable.nextTransitionIndex` after every
transition, including transitions with no effects, and pass it as
`transitionIndex` when recreating the durable execution.

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
the complete built-in effect to `runtime` so the application can map timers,
sends and child actors without coupling XState core to either host.

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
