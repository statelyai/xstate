---
'xstate': minor
'@xstate/test': minor
---

Path-based and property-based testing are now one API with two generation
strategies. `testPaths()` walks the machine's state graph; `propertyTest()`
generates randomized sequences. They take the same options, run through the
same engine, and return the same coverage object and failure type.

**One `events` shape.** Path generation accepts the descriptor map
`propertyTest()` already took — a bare generator, `{ case, generate, resolve,
when, weight }`, or an array of either. `generate` is sampled into `samples`
(default `3`) concrete payloads before traversal, seeded by `seed`. `when` and
`resolve` apply identically on both sides. In `@xstate/test`, fast-check
arbitraries are sampled automatically.

**One `sut`.** `TestParam` (`events` executors plus `states` assertions) and the
`test.create` option are replaced by a single `sut`:

```ts
// Before
await path.test({
  events: { INC: ({ event }) => store.dispatch(event) },
  states: { active: (snapshot) => expect(rendered()).toBe(snapshot.context.count) }
});

// After
await path.test({
  sut: {
    create: () => ({
      send: (event) => store.dispatch(event),
      states: {
        active: (snapshot) => expect(rendered()).toBe(snapshot.context.count)
      }
    })
  }
});
```

`states` can also be written at the top level, without a `sut`. Per-state
`meta.test` hooks run in both entry points. `fromTestParam({ events, states })`
converts the old shape in one call. `createPlaywrightTestModelSession()` is
gone; `createPlaywrightSut()` now takes optional `read`/`projectModel` and an
optional `states` map.

**`testPaths()`.** `testPaths(machine, options)` returns `{ coverage, results }`
and throws the same `ModelTestFailure` — with trace, portable fixture, and
coverage — that `propertyTest()` throws. `TestModel#testPaths()` and
`TestModel#testPath()` run through the same engine, so paths now get coverage,
labels, requirements, transition pairs, and replayable fixtures.
`coverage.exploration.strategy` is `'paths'` or `'property'`, with `pathCount`
and `pathGenerator` on the path side.

**Renamed exports.** Shared names dropped their `Property` prefix:
`PropertyCoverage` → `TestCoverage`, `PropertySut` → `TestSut`,
`PropertySutSession` → `TestSutSession`, `PropertyTrace` → `TestTrace`,
`PropertyTestFailure` → `ModelTestFailure`, `PortablePropertyReplayFixture` →
`TestFixture`, `PropertySuite` → `TestSuite`, `PropertyInvariant` →
`TestInvariant`, `PropertyTemporal` → `TestTemporal`,
`PropertyReferenceOracle` → `TestReference`,
`PropertyReplayNotReproducedError` → `ReplayNotReproducedError`,
`formatPropertyCoverage()` → `formatTestCoverage()`, `propertyCoverageToJSON()`
→ `testCoverageToJSON()`, `formatPropertyCoverageJUnit()` →
`formatTestCoverageJUnit()`, `formatPropertyCoverageHTML()` →
`formatTestCoverageHTML()`, `assertPropertyCoverage()` → `assertTestCoverage()`,
`formatPropertyTrace()` → `formatTestTrace()`, `serializePropertyTrace()` →
`serializeTestTrace()`, `replayPropertyTest()` → `replayTest()`,
`generatePropertySuite()` → `generateTestSuite()`, `replayPropertySuite()` →
`replayTestSuite()`, `describePropertySuite()` → `describeTestSuite()`. The old
names remain as deprecated aliases. `propertyTest()` and
`PropertyScenarioRunner` keep their names.

**Removed.** These have no deprecated alias:

- `TestPathResult` and `TestStepResult` → `TestPathRunResult` (`{ path, passed,
  error }`), returned in the `results` array of `testPaths()`. Per-step results
  are no longer collected; use the `ModelTestFailure` trace instead.
- `TestModel#testState()` and `TestModel#testTransition()` → the `states` option
  (or `sut.states`), which runs after every stable step.
- `createPlaywrightTestModelSession()` and `PlaywrightTestModelParams` →
  `createPlaywrightSut()`, which takes optional `read`/`projectModel` and an
  optional `states` map.
- `TestPath#test(params)` and `TestModel#testPath(path, params)` no longer take
  the `{ events, states }` `TestParam`; they take the shared options, so the
  executors move to `sut` (or `fromTestParam({ events, states })`).
- `testPaths()` rejects `outcomes` and `commands`: path generation walks the
  pure state graph, which models neither invoked actors nor `after`
  transitions. Use `propertyTest()` with `mode: 'executed'` for those.
