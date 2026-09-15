---
'xstate': minor
---

Added coverage report formatters for `propertyTest()`. The `coverage` object it resolves with can now be rendered as text or markdown, exported as stable JSON, JUnit XML or a self-contained HTML page, and asserted against thresholds.

```ts
import {
  assertPropertyCoverage,
  formatPropertyCoverage
} from 'xstate/graph';

const { coverage } = await propertyTest(machine, { adapter, events, invariant });

console.log(formatPropertyCoverage(coverage));
// transitions: 7/9 covered (77.8%), 1 uncovered, 1 unreachable, 0 unknown

assertPropertyCoverage(coverage, { transitions: 1, stateNodes: 0.9 });
```

New exports: `formatPropertyCoverage`, `formatPropertyCoverageJUnit`, `formatPropertyCoverageHTML`, `propertyCoverageToJSON`, `assertPropertyCoverage`, `formatPropertyCoverageId`, and the `PropertyCoverageJSON` type.
