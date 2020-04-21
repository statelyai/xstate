---
'xstate': patch
---

By default, spawned machines will now have `execute: true` to prevent edge-cases where the parent service is configured with `execute: false` and this is (erroneously) set for invoked child services.
