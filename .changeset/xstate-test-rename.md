---
'@xstate/test': minor
---

`@xstate/fast-check` is now `@xstate/test` 2.0, and fast-check is wired in for you.

`propertyTest()` and `generatePropertySuite()` are re-exported from `@xstate/test` with the fast-check adapter already applied, so fast-check's options (`seed`, `numRuns`, `maxCommands`, `scheduler`, `replayPath`, …) are written at the top level:

```ts
import { propertyTest } from '@xstate/test';

await propertyTest(machine, {
  seed: 1,
  numRuns: 100,
  maxCommands: 8,
  events: { INC: fc.record({ value: fc.integer() }) },
  invariant: ({ snapshot }) => {
    expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
  }
});
```

Event generators are derived from the machine's `schemas.events` when it declares them, so `events` only has to name the generators you want to control. Pass `deriveEvents: false` to opt out.

The whole property-testing surface — `replayPropertyTest`, `describePropertySuite`, `formatPropertyCoverage`, `assertPropertyCoverage`, `checkLinearizable`, `PropertyTestFailure` and the rest — is re-exported from `@xstate/test`, so it is the only import a test file needs. `fastCheckAdapter` is still exported, and passing `adapter` still overrides the implicit one.

`@xstate/test-playwright` has been folded in as the `@xstate/test/playwright` subpath export. `fast-check` is now a required peer dependency.

Migrating:

- From `@xstate/fast-check`: rename the import, and replace `adapter: fastCheckAdapter({ ... })` with the same options spelled at the top level.
- From `@xstate/test` 0.x: `createModel().withEvents()` is replaced by `propertyTest()`.
- From `@xstate/test` 1.0 beta: `createTestModel()` now lives in `xstate/graph` (and is re-exported here).
