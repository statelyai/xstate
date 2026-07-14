---
'@xstate/vue': patch
---

Fixed the test configuration so that the package's tests are correctly discovered and run. The `include` glob in `vitest.config.mts` pointed to a non-existent file, which meant no tests were executed and coverage was reported as 0%.
