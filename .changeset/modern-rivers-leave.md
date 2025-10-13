---
'@xstate/store': minor
---

Added an overload to `useSelector` that allows you to select the entire snapshot:

```ts
// No selector provided, return the entire snapshot
const snapshot = useSelector(store);
```
