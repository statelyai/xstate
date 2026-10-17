---
'@xstate/test': major
---

Names are consistent:

| Before                   | After                     |
| ------------------------ | ------------------------- |
| `createFailureDatabase`  | `createTestFailureStore`  |
| `FailureDatabaseOptions` | `TestFailureStoreOptions` |
| `serializeTestSuite`     | `testSuiteToJSON`         |
| `ModelTestFailure`       | `ModelTestFailureError`   |

`testSuiteToJSON` still returns the JSON string that `parseTestSuite` reads. The error's `name` is now `'ModelTestFailureError'`.
