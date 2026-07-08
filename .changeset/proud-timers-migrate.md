---
'xstate': minor
---

Persistence hardening: pending timers, snapshot versioning, and route guard safety.

- **Pending timers are persisted and restored.** Delayed transitions/events (`after`, `enq.raise(..., { delay })`) targeting the actor itself are captured on the persisted snapshot as `_pendingEffects` — serialized action descriptors (`{ type: '@xstate.raise', event, id, delay }`) plus runtime progress (`startedAt`, `elapsed`) — including for rehydrated child actors — and re-executed with the remaining delay on `actor.start()`. The restore strategy is configurable via the `timers` actor option:

  ```ts
  const actor = createActor(machine, {
    snapshot: persisted,
    timers: 'resume' // default — a 5min timer persisted at 1min fires after 4 more minutes
    // 'restart'     — timers start over with their full delay
    // 'absolute'    — honor original wall-clock expiry; expired timers fire immediately
    // (timer) => ms — custom strategy
  });
  ```

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
