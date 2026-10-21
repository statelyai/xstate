---
'xstate': minor
---

Persistence hardening: pending timers, snapshot versioning, and route guard safety.

- **Pending timers are explicit in machine snapshots.** Delayed transitions and sends are represented by deterministic declarations in `snapshot.timers`. Timer firing arrives at the source as `{ type: 'xstate.timer', id }`; consuming it removes the declaration and produces the real delivery effect. Scheduling and cancellation effects remain ordered with other transition effects.

  Reaching a final state or explicitly stopping a machine emits ordered cancellation effects for every remaining timer and clears those declarations. Persisted delayed sends preserve `self`, parent, and active-child relationships without rebinding a stopped actor to a replacement that happens to share its ID.

  ```ts
  const [snapshot, effects] = machine.initialTransition(input);

  snapshot.timers;
  // {
  //   'xstate.after.300000.machine.pending': {
  //     id: 'xstate.after.300000.machine.pending',
  //     delay: 300000,
  //     type: '@xstate.raise',
  //     event: { type: 'xstate.after.300000.machine.pending' },
  //     target: 'self'
  //   }
  // }
  ```

  Snapshots contain no wall-clock timestamps or native timeout handles. The runtime owns that bookkeeping through `scheduleTimer(source, id, delay)` and `cancelTimer(source, id)`. A locally restored `createActor(...)` restarts each timer with its declared delay; durable runtimes can persist their timing data separately.

  The previous `PendingEffect` type and `ActorOptions.timers` restore strategy are removed. Timing restoration policy now belongs to the runtime rather than the machine snapshot.

- **Persisted snapshots are versioned.** `machine.version` is stamped onto persisted snapshots; restoring a snapshot whose version doesn't match throws unless the machine config provides a `migrate` function:

  ```ts
  const machine = createMachine({
    version: '2',
    migrate: (persisted, fromVersion) => ({
      ...persisted,
      version: '2',
      context: upgradeContext(persisted.context)
    })
    // ...
  });
  ```

- **Routes are transition functions.** Consistent with `on`/`choice`, a route is now authored as a function that acts as its guard and resolver — returning `undefined`/`false` blocks the route; returning `true` or a config object (optionally with a `context` update and `input`/`reenter`/`meta`) allows it:

  ```ts
  profile: {
    id: 'profile',
    route: ({ context, guards }) => {
      if (!guards.isLoggedIn(context)) return;
      return { context: { ...context, visits: context.visits + 1 } };
    }
  }
  ```

  The object form (without `guard`) remains for static routes; object-form `guard` references (strings) are only produced by the JSON layer (`createMachineFromConfig`) and now fail loudly when unimplemented instead of silently allowing the route. Routes are also included in `serializeMachine(machine)` output.
