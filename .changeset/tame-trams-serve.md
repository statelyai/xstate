---
'@xstate/store': patch
---

Fix synchronous subscribe callbacks still not re-running if a subscription triggers another one through multiple levels of computed atoms.
