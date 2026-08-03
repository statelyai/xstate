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
