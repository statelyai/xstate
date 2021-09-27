---
'xstate': patch
---

Meta data can now be specified for `invoke` configs in the `invoke.meta` property:

```js
const machine = createMachine({
  // ...
  invoke: {
    src: (ctx, e) => findUser(ctx.userId),
    meta: {
      api: 'User Finder 2000'
    }
  }
});
```
