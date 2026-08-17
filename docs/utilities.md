---
title: Utilities
description: Work with actors, snapshots and state values.
---

| Utility | Purpose |
| --- | --- |
| `waitFor(actor, predicate)` | Wait for a matching snapshot. |
| `toPromise(actor)` | Resolve with an actor's output. |
| `initialTransition(logic, input?)` | Get `[snapshot, actions]` for the initial transition without starting an actor. |
| `transition(logic, snapshot, event)` | Calculate `[nextSnapshot, actions]` for an event. |
| `mapState(...)` | Map one state value to another value. |
| `SimulatedClock` | Control time in tests. |

```ts
const finalSnapshot = await waitFor(actor, (snapshot) =>
  snapshot.matches('complete')
);
```

Use `initialTransition(...)` and `transition(...)` for pure calculations. They do not start actors or run effects; the returned actions describe the effects that an actor would execute. The older `getInitialSnapshot(...)` and `getNextSnapshot(...)` are deprecated aliases that return only the snapshot. Use `SimulatedClock` to test delays without waiting for real time.

For example, a route loader can calculate an initial view without starting a long-lived actor. A timeout test can advance a simulated clock to the retry state.

## Utilities cheatsheet

```ts
await waitFor(actor, predicate);
await toPromise(actor);
const [initialSnapshot, initialActions] = initialTransition(logic, input);
const [nextSnapshot, actions] = transition(logic, snapshot, event);
```
