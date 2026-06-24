---
'xstate': major
---

String target shorthand is no longer accepted for transition configs. Use the object form with `target` instead:

```ts
createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        start: { target: 'active' }
      }
    },
    active: {}
  }
});
```
