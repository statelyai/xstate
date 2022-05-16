---
'@xstate/graph': major
---

Coverage can now be obtained from a tested test model via `testModel.getCoverage(...)`:

```js
import { configure, createTestModel } from '@xstate/test';
import {
  coversAllStates,
  coversAllTransitions
} from '@xstate/test/lib/coverage';

// ...

const testModel = createTestModel(someMachine);

const plans = testModel.getShortestPlans();

for (const plan of plans) {
  await testModel.testPlan(plan);
}

// Returns default coverage:
// - state coverage
// - transition coverage
const coverage = testModel.getCoverage();

// Returns state coverage
const stateCoverage = testModel.getCoverage([coversAllStates()]);

// Returns state coverage
const stateCoverage = testModel.getCoverage([coversAllStates()]);

// Throws error if state coverage not met
testModel.testCoverage([stateCoverage]);
```
