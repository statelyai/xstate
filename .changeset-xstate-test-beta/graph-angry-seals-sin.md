---
'@xstate/graph': patch
---

pr: #4308
author: davidkpiano
commit: af032db12

Traversing state machines that have delayed transitions will now work as expected:

```ts
const machine = createMachine({
  initial: 'a',
  states: {
    a: {
      after: {
        1000: 'b'
      }
    },
    b: {}
  }
});

const paths = getShortestPaths(machine); // works
```
