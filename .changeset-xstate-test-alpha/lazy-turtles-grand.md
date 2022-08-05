---
'@xstate/test': major
---

pr: #3036
author: @davidkpiano

Added validation on `createTestModel` to ensure that you don't include invalid machine configuration in your test machine. Invalid machine configs include `invoke`, `after`, and any actions with a `delay`.

Added `createTestMachine`, which provides a slimmed-down API for creating machines which removes these types from the config type signature.
