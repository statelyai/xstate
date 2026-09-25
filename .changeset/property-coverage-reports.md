---
'xstate': minor
---

Added coverage report formatters for `propertyTest()` and `testPaths()`. The `coverage` object they resolve with can now be rendered as text or markdown, exported as stable JSON, JUnit XML or a self-contained HTML page, and asserted against thresholds.

```ts
import { assertTestCoverage, formatTestCoverage } from 'xstate/graph';

const { coverage } = await propertyTest(machine, { adapter, events, invariant });

console.log(formatTestCoverage(coverage));
// transitions: 7/9 covered (77.8%), 1 uncovered, 1 unreachable, 0 unknown

assertTestCoverage(coverage, { transitions: 1, stateNodes: 0.9 });
```

New exports: `formatTestCoverage`, `formatTestCoverageJUnit`, `formatTestCoverageHTML`, `testCoverageToJSON`, `assertTestCoverage`, `formatTestCoverageId`, and the `TestCoverageJSON` type.
