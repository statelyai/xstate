---
'@xstate/store': major
---

The `fromStore(config)` function now only supports a single config object argument.

```ts
const storeLogic = fromStore({
  context: (input: { initialCount: number }) => ({ count: input.initialCount }),
  on: {
    inc: (ctx, ev: { by: number }) => ({
      ...ctx,
      count: ctx.count + ev.by
    })
  }
});
```
