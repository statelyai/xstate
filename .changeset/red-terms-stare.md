---
'xstate': minor
---

`context` factories receive `self` now so you can immediately pass that as part of the input to spawned actors.

```ts
setup({
  /* ... */
}).createMachine({
  context: ({ spawn, self }) => {
    return {
      childRef: spawn('child', { input: { parent: self } })
    };
  }
});
```
