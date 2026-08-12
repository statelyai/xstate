---
title: Utilities
description: Work with actors, snapshots and state values.
---

| Utility | Purpose |
| --- | --- |
| `waitFor(actor, predicate)` | Wait for a matching snapshot. |
| `toPromise(actor)` | Resolve with an actor's output. |
| `getInitialSnapshot(logic, input)` | Get the initial snapshot without starting an actor. |
| `getNextSnapshot(logic, snapshot, event)` | Calculate the next snapshot. |
| `mapState(...)` | Map one state value to another value. |
| `SimulatedClock` | Control time in tests. |

```ts
const finalSnapshot = await waitFor(actor, (snapshot) =>
  snapshot.matches('complete')
);
```

Use `getInitialSnapshot(...)` and `getNextSnapshot(...)` for pure calculations. They do not start actors or run effects. Use `SimulatedClock` to test delays without waiting for real time.

For example, a route loader can calculate an initial view without starting a long-lived actor. A timeout test can advance a simulated clock to the retry state.

## Utilities cheatsheet

```ts
await waitFor(actor, predicate);
await toPromise(actor);
getInitialSnapshot(logic, input);
getNextSnapshot(logic, snapshot, event);
```
