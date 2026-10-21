---
'@xstate/store-react': patch
'@xstate/store-vue': patch
'@xstate/store-solid': patch
'@xstate/store-preact': patch
---

The `compare` function passed to `useSelector` is now typed as `(a: T, b: T)` instead of `(a: T | undefined, b: T)`, so the previous value is no longer typed as possibly `undefined`.
