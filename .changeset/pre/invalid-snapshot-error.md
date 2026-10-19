---
'xstate': patch
---

`createActor(machine, { snapshot })` reports a persisted snapshot that cannot represent a state as an `'error'` snapshot with an `InvalidSnapshotError`, instead of starting an unusable actor. This covers snapshots that are not objects, have no `value` or an invalid one (not a state name or an object of state values, or several active children of a non-parallel state), and values naming states the machine does not have. Unknown fields are still ignored.

```ts
import { createActor, InvalidSnapshotError } from 'xstate';

const actor = createActor(machine, { snapshot: stored });
const snapshot = actor.getSnapshot();
if (snapshot.status === 'error' && snapshot.error instanceof InvalidSnapshotError) {
  // fall back to a fresh actor
}
```
