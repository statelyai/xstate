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
      summary: 'Finds user',
      updatedAt: '2021-09-...',
      version: '4.12.2'
      // other descriptive meta properties
    }
  }
});
```
