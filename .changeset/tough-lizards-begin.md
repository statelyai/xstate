---
'xstate': patch
---

Fixed inference for `assign` using `PropertyAssigner`, like here:

```ts
actions: assign({
  counter: 0,
  delta: (ctx, ev) => ev.delta
});
```
