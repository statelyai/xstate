---
'xstate': major
---

Pure transitions now return every effect needed to interpret actor logic in execution order. This includes actor spawning, starting and stopping, event delivery, emitted events, timers, custom effects, and actor termination. `createActor(...)` executes the same effects through the default actor system.

Each effect exposes `exec(runtime?)`. Omitting the runtime uses the effect's XState actor system; supplying an `ActorSystemRuntime` delegates execution to a custom host. `executeEffects(...)` executes and awaits the effects sequentially:

```ts
let [snapshot, effects] = machine.initialTransition(input);
await executeEffects(effects, runtime);

while (snapshot.status === 'active') {
  const event = await dequeue();
  [snapshot, effects] = machine.transition(snapshot, event);
  await executeEffects(effects, runtime);
}
```

`ActorSystemRuntime` defines operations for spawning, starting, stopping and terminating actors; sending and emitting events; and scheduling or cancelling timers. No runtime or `actorScope` argument is required by `machine.initialTransition(...)`, `machine.transition(...)`, or `machine.restoreSnapshot(...)`.

Leaving an invoking state emits `@xstate.stop` with the stopped actor and its ID. Stops are also exposed by `getMicrosteps(...)` and `getInitialMicrosteps(...)`. Effect ordering matches `createActor(...)`: exit actions run before timer cancellation and child stopping; reentry produces stop, spawn, then start; and terminal machines stop children before terminating.

When logic first reaches `done` or `error`, it emits a final `@xstate.terminate` effect. Custom runtimes implement `terminateActor(actor, termination)` to publish the terminal result, close the actor, clean up its runtime resources, and notify its parent.

Pending delayed deliveries are declared in `snapshot.timers`. A runtime schedules the timer ID and sends `{ type: 'xstate.timer', id }` to its source when due; XState then removes the timer and emits the actual raise or send effect. Runtime-specific deadlines and timer handles remain outside the snapshot.

Hand-written actor logic and `createLogic(...)` now return executable effects from both initial and subsequent transitions. `ActorLogic.executeEffects` has been removed. `ActorLogic.start(snapshot, scope, options?)` receives `options.restored`, allowing logic to distinguish restoration from a fresh start.
