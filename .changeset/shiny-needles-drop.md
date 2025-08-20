---
'@xstate/store': patch
---

Fix `createStoreHook` to create a single shared store instance across all components. Previously, the implementation was creating independent store instances, but now multiple components using the same hook will share state as expected.
