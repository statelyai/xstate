---
'xstate': minor
'@xstate/fast-check': minor
---

Improve property testing accuracy, replay, and coverage:

- Add the `always` and `never` temporal operators, checked on every stable step.
  Bounded `eventually`/`until` properties whose `within` window did not elapse
  before the run ended are now reported as inconclusive instead of failing.
- Report a clear error when an event generator produces a non-object payload,
  naming the event case and pointing at `resolve`.
- Report exact execution metrics: `coverage.exploration` now includes
  `attemptedRuns` alongside `completedRuns` and `configuredRuns`.
- `replayPropertyTest()` accepts a `sut` implementation, stops at the recorded
  `failedAt` step, and throws when the recorded failure does not reproduce.
  Model, reference, and SUT projections are compared with structural,
  key-order insensitive deep equality, exported as `defaultEquivalent`.
- Report reachability correctly for states reachable only through a history
  state's default target, an `invoke` `onDone`/`onError`/`onSnapshot`
  transition, or a state's `onDone` transition.
- Inspection events for microsteps are emitted again when transition details are
  collected. `transition()` no longer allocates a details object, so pure
  transitions stay on the fast path.

```ts
await propertyTest(machine, {
  adapter: fastCheckAdapter(),
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
