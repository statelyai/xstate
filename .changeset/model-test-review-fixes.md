---
'xstate': patch
'@xstate/test': patch
---

Model-based and property-based testing fixes:

- `states` keys (`'shopping'`, `'form.email'`, `'#cart.shopping'`) now match when the source is a plain machine, in `propertyTest()`, `testPaths()`, `replayTest()`, `session.states`, and `createPlaywrightSut({ states })`. Passing `createTestModel(machine)` is no longer needed.
- `testPaths()` compares every step with the snapshot traversal planned and fails with `Path diverged at step N: expected …, got …` instead of passing on a different path. Traversal offers only the `after` transition that is due first, counting time spent in enclosing states, and executed mode advances the clock to the timer's actual due time, so delays computed at runtime work.
- `testPaths()` stops after `limit` traversal steps, now `10_000` by default, with an error that points at `serializeState` and `stopWhen` for machines whose context grows without bound.
- A source named in `testPaths({ outcomes })` needs no implementation. Replay fixtures record every stubbed source (`fixture.stubs`) and store errors as `{ xstate$$error, name, message }`, which `replayTest()` turns back into `Error` objects.
- Failure messages lead with the cause, a `Reproduce: seed …, path …, replayPath …` line, and the number of shrinks, then one line per step: `N. <origin> <event> -> <state>`. `testPaths()` failures name the path: `Path 2 (ADD → REMOVE) failed: …`. The new `formatSnapshot` option controls how states print:

  ```ts
  await propertyTest(machine, {
    events,
    formatSnapshot: (snapshot) => snapshot.value
  });
  ```

- In `@xstate/test`, `maxCommands` above fast-check's default size is honored, `numRuns` bounds batched campaigns (`until`, `frontiers: 'auto'`) when `maxRuns` is not set, and `testPaths()` accepts fast-check arbitraries with a top-level `states` map and no `sut`.
- Executed-mode steps wait for work queued with `setTimeout(0)`. A step that settles while an invoked actor's promise is still pending lists it in `pendingActors`, counted by `coverage.exploration.pendingActorSteps`.
- `testPaths()` coverage reports `stoppedBecause: 'paths'`, text reports print `truncated` only when true and leave the `(runtime …)` placeholders out of the counts, and transition pairs are declared only between transitions with static targets.
- Zod schema derivation generates valid values for numeric enums, exhaustive enum-keyed records, tied exclusive bounds, combined and fractional `multipleOf`, `exactOptional`, `lazy`, and wildcard event keys, and throws a path-named error for unsupported, unsatisfiable, or recursive schemas instead of hanging.
- `createPlaywrightSut()` removes a case's routes before another case's mock is applied.
- `xstate/graph` no longer exports the internal helpers `fnv1a`, `createSeededRng`, `assertNotTestParam`, `PropertyOutcomeRegistry`, and `deepEqual`.
