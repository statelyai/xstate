---
'@xstate/store': patch
---

Fix async atoms losing their dependencies after a request succeeds or fails.
Changing a dependency now reloads the value after settlement, including when a
custom comparator suppresses an equivalent result.
