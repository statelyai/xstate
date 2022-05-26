---
'@xstate/test': major
---

@author: @davidkpiano

Added validation on `createTestModel` to ensure that you don't include invalid configuration in your test machine. Invalid configs include `invoke`, `after`, and any actions with a `delay`.

Added `createTestMachine`, which provides a slimmed-down API for creating machines which removes these types from the config type signature.
