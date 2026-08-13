---
title: Durable execution
description: Run pure XState transitions on a durable host.
---

Import the experimental durable execution helper from `xstate/durable` when a
workflow platform owns persistence, retries, timers, messaging and child
execution.

```ts
import { createDurableExecution } from 'xstate/durable';

const d = createDurableExecution(machine, {
  runtime: {
    sendEvent: (_source, target, event) =>
      host.send(target.id, event),
    scheduleTimer: (source, id, delay) =>
      host.schedule({ actorId: source.id, timerId: id, delay }),
    cancelTimer: (source, id) =>
      host.cancelTimer({ actorId: source.id, timerId: id })
    // Map the remaining ActorSystemRuntime operations supported by the host.
  },
  executeEffect: (effect, { id }, runtime) =>
    host.runDurably(id, () => effect.exec(runtime)),
  waitForEvent: () => host.waitForEvent()
});

let [state, effects] = d.initialTransition(input);
await d.executeEffects(effects);

while (state.status === 'active') {
  const event = await d.waitForEvent();
  [state, effects] = d.transition(state, event);
  await d.executeEffects(effects);
}
```

`initialTransition()` and `transition()` remain pure. The helper tags their
ordered effects with stable IDs such as `0:0` and `1:0`. A durable host should
memoize or deduplicate each effect using that ID. Replaying the same events from
the beginning reconstructs the same snapshots, effects and IDs.

The host runtime subsumes the local actor system:

- Actions run as durable steps or activities.
- Sends route through the host's actor or workflow identity.
- Timers register host-managed delivery and return immediately. The host stamps
  `dueAt` when it durably commits the timer; transition calculation never reads
  wall-clock time.
- Invoked or spawned actors use host child-workflow facilities when available.
- Unsupported runtime operations throw.

The helper does not prescribe storage, inboxes, retries or timer
implementations. Hosts that restore from checkpoints instead of replaying from
the beginning should persist `d.nextTransitionIndex` after every transition,
including transitions with no effects, and pass it as `transitionIndex` when
recreating the durable execution.
