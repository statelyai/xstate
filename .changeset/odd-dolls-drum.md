---
'@xstate/react': patch
---

Fixed an issue that caused the internally used `useSyncExternalStore` to warn about the computed snapshot not being cached when a not-started machine servive was passed to `useActor`.
