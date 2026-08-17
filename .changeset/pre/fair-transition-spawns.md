---
'xstate': patch
---

Spawning a child with `enq.spawn(...)` from a transition function now creates and starts the child actor exactly once for the committed transition.

```ts
const machine = createMachine({
  on: {
    spawn: (_, enq) => {
      enq.spawn(childMachine, { registryKey: 'child' });
    }
  }
});
```
