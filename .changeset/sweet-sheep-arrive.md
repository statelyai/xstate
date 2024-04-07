---
'xstate': patch
---

`fromPromise` now passes a signal into it's creator function.

```ts
const logic = fromPromise(({ signal }) =>
  fetch('https://api.example.com', { signal })
);
```

This will be called whenever the state transitions before the promise is resolved. This is useful for cancelling the promise if the state changes.
