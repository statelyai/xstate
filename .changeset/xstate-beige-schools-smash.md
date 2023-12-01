---
'xstate': minor
---

Merge `sendBack` and `receive` with other properties of `fromCallback` logic creator.

```ts
const callbackLogic = fromCallback(({ input, system, self, sendBack, receive }) => { ... });
```
