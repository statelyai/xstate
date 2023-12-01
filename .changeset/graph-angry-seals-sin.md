---
'@xstate/graph': patch
---

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
