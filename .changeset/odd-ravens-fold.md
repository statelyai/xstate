---
'@xstate/store': patch
---

Fix TypeScript error localization in `createStore(…)` overloads

Previously, TS errors in transitions would appear on the `createStore` call itself rather than on the specific transition. This was caused by the 3rd overload (for `StoreLogic`) interfering with overload resolution.
