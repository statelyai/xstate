---
'xstate': major
'@xstate/store': patch
---

Actor logic now returns effects from both regular and initial transitions.

Hand-written actor logic should return `[snapshot, effects]` from `transition(...)` and provide `initialTransition(...)` for creating the initial `[snapshot, effects]` tuple. `getInitialSnapshot(...)` remains available for snapshot-only reads.

```ts
const logic = {
  transition: (snapshot, event) => [snapshot, []],
  initialTransition: (input, _scope) => [
    {
      status: 'active',
      output: undefined,
      error: undefined,
      input
    },
    []
  ],
  getInitialSnapshot: (scope, input) => logic.initialTransition(input, scope)[0]
};
```

`transition(...)` and `initialTransition(...)` continue to return `[snapshot, actions]` for machine logic.

`fromStore(...)` effects now run after the actor snapshot is committed, so effect callbacks read the updated snapshot from `enqueue.getSnapshot()`.
