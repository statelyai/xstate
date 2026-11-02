---
'xstate': patch
---

Async logic that resolves `null` now reports `null` as its output instead of `undefined`. Rejecting with `null` likewise reports `null` as the error.

```ts
const logic = createAsyncLogic({ run: async () => null });
// snapshot.output === null
// parent receives { type: 'xstate.done.actor', output: null, ... }
```
