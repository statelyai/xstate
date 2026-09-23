---
'@xstate/test': minor
---

`@xstate/test` 2.0 is model-based and property-based testing for XState v6,
built on fast-check. It re-exports the testing API of `xstate/graph` and adds
fast-check-backed versions of `propertyTest()`, `testPaths()`, and
`generateTestSuite()` that take fast-check's options (`seed`, `numRuns`,
`maxCommands`, `replayPath`, `scheduler`, …) at the top level:

```ts
import * as fc from 'fast-check';
import { propertyTest, testPaths } from '@xstate/test';

await propertyTest(cartMachine, {
  seed: 1,
  numRuns: 100,
  events: { ADD: fc.record({ sku: fc.constantFrom('apple', 'pear') }) },
  sut: cartSut
});

await testPaths(cartMachine, {
  events: { ADD: fc.record({ sku: fc.constantFrom('apple', 'pear') }) },
  sut: cartSut
});
```

`testPaths()` samples fast-check arbitraries into concrete payloads before
traversal. Both functions derive generators from the machine's
`schemas.events` for every event type `events` does not configure; pass
`deriveEvents: false` to turn that off. `fastCheckAdapter()` is exported for
the generator-neutral functions in `xstate/graph`, and passing `adapter`
overrides the built-in one.

`fast-check` is a required peer dependency. `@xstate/test/playwright` is a
subpath export for testing Playwright pages.

Migrating from `@xstate/test` 1.0 beta: `createTestModel()` and the path
functions now live in `xstate/graph` and are re-exported here; `path.test()`
takes a `sut` instead of `{ events, states }` (see `fromTestParam()`).
Migrating from 0.x: `createModel(machine).withEvents({ ... })` is replaced by
`testPaths(machine, { events, sut })`.
