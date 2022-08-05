---
'@xstate/react': patch
---

Fixed an issue with `useSelector` always computing fresh snapshots internally for uninitialized services. This avoids the internal `useSyncExternalStore` from warning about the snapshot value not being cached properly.
