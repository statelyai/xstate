---
'xstate': patch
---

author: @farskid
author: @Andarist

Adjusted TS type definitions of the `withContext` and `withConfig` methods so that they accept "lazy context" now.

Example:

```js
const copy = machine.withContext(() => ({
  ref: spawn(() => {})
}));
```
