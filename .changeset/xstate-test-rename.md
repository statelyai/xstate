---
'@xstate/test': minor
---

`@xstate/test` 2.0 is model-based and property-based testing for XState v6,
built on fast-check. `propertyTest()`, `testPaths()`, and
`generateTestSuite()` take fast-check's options (`seed`, `numRuns`,
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
`deriveEvents: false` to turn that off. Passing `adapter` overrides the
built-in fast-check adapter.

`fast-check` is a required peer dependency. `@xstate/test/playwright` is a
subpath export for testing Playwright pages.

Migrating from `@xstate/test` 1.0 beta: `createTestModel()` and the path
functions now live in `xstate/graph`; `testPaths(model, { paths, sut })`
replaces `path.test()` (see `fromTestParam()` to keep `{ events, states }`).
Migrating from 0.x: `createModel(machine).withEvents({ ... })` is replaced by
`testPaths(machine, { events, sut })`.
