---
'xstate': minor
---

Removed `createTestModel` and `TestModel` from `xstate/graph`; use `@xstate/test`. The types used only by them (`TestModelOptions`, `TestParam`, `TestPath`, `TestPathResult`, `TestStepResult`, `TestMeta`, `EventExecutor`) and `createShortestPathsGen`/`createSimplePathsGen` are removed too. `xstate/graph` keeps its path traversal functions.

```ts
// Before
const model = createTestModel(machine, { events });
for (const path of model.getShortestPaths()) await path.test(params);
// After
import { testPaths } from '@xstate/test';
await testPaths(machine, { events, sut });
```
