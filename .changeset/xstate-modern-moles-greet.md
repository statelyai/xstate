---
'xstate': major
---

Removed the ability to define delayed transitions using an array. Only object variant is supported now:

```ts
createMachine({
  initial: 'a',
  states: {
    a: {
      after: {
        10000: 'b',
        noon: 'c'
      }
    }
    // ...
  }
});
```
