---
'@xstate/react': patch
---

Fixed an issue with `toObserver` being internally imported from `xstate/lib/utils` which has broken UMD build and the declared peer dep contract.
