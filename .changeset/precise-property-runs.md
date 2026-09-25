---
'xstate': minor
'@xstate/test': minor
---

Property test accuracy, replay, and coverage:

- The `always` and `never` temporal operators are checked on every stable
  step. A bounded `eventually` or `until` property whose `within` window has
  not elapsed when a run ends is reported as inconclusive, not failed.
- An event generator that produces a non-object payload fails with an error
  naming the event case and pointing at `resolve`.
- `coverage.exploration` reports `attemptedRuns`, including shrink attempts,
  alongside `completedRuns` and `configuredRuns`.
- `replayTest()` accepts a `sut`, stops at the recorded `failedAt` step, and
  throws when the recorded failure does not reproduce. Model, reference, and
  SUT projections are compared with structural, key-order-insensitive deep
  equality, exported as `defaultEquivalent`.
- Coverage reports states that are reachable only through a history state's
  default target, an invoke's `onDone`/`onError`/`onSnapshot` transition, or a
  state's `onDone` transition as reachable.

```ts
await propertyTest(machine, {
  events,
  temporal: [
    {
      type: 'never',
      id: 'no-error-state',
      predicate: ({ snapshot }) => snapshot.matches('error')
    }
  ],
  invariant
});
```
