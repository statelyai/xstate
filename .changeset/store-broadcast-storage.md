---
'@xstate/store': minor
---

Add broadcast-aware storage helpers for persisted stores.

Use `createBroadcastStorage(...)` with `persist(...)` and `subscribeToBroadcastStorage(...)` to rehydrate a persisted store when another tab or window writes to the same storage key.
