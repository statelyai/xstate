---
'xstate': minor
'@xstate/fast-check': minor
'@xstate/test-playwright': patch
---

Added `mode: 'executed'` to `propertyTest()`. Property runs drive a real actor on a `SimulatedClock` instead of stepping the machine through `transition()`, so invoked and spawned actors run, their `onDone`/`onError`/`onSnapshot` transitions fire, and `after` transitions are reachable through generated `advance` commands — no system under test required.

Invoked actors are steered with `actors` (fixed logic) or `outcomes` (a generated, shrinkable result per invoke source):

```ts
await propertyTest(machine, {
  adapter: fastCheckAdapter({ numRuns: 100 }),
  mode: 'executed',
  outcomes: {
    fetchUser: fc.oneof(
      fc.record({ ok: fc.constant(true), output: fc.record({ id: fc.integer() }) }),
      fc.record({ ok: fc.constant(false), error: fc.constant('offline') })
    )
  },
  events: { FETCH: fc.constant({}) },
  commands: { advance: fc.integer({ min: 100, max: 900 }) },
  invariant: ({ snapshot }) => {
    expect(snapshot.value).not.toBe('stuck');
  }
});
```

Failure fixtures from an executed run record every actor outcome, so `replayPropertyTest()` reproduces the failure against stub actors without calling the real services. Traces gain `'actorEvent'` timeline entries showing what the actor system did on its own, and `coverage.exploration.mode` reports which mode a campaign used.

Pure mode is unchanged and remains the default.
