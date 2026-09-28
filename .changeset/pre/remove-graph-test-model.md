---
'xstate': minor
---

Removed `createTestModel` and `TestModel` from `xstate/graph`; use `@xstate/test`. The types used only by them (`TestModelOptions`, `TestParam`, `TestPath`, `TestPathResult`, `TestStepResult`, `TestMeta`, `EventExecutor`) and `createShortestPathsGen`/`createSimplePathsGen` are removed too. `xstate/graph` keeps its path traversal functions.

```ts
// Before
const model = createTestModel(machine, {
  events: [
    { type: 'SUBMIT', zip: '12345' },
    { type: 'SUBMIT', zip: 'abc' },
    { type: 'CANCEL' }
  ]
});
for (const path of model.getShortestPaths()) await path.test(params);

// After: `events` is keyed by event type; each payload becomes a named case
import * as fc from 'fast-check';
import { testPaths } from '@xstate/test';

await testPaths(machine, {
  events: {
    SUBMIT: [
      { case: 'valid', generate: fc.constant({ zip: '12345' }) },
      { case: 'invalid', generate: fc.constant({ zip: 'abc' }) }
    ]
  },
  samples: 1,
  sut
});
```

Event types without a payload, such as `CANCEL`, need no entry.
