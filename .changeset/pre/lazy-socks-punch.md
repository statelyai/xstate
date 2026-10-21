---
'xstate': major
---

Require history states to declare a non-empty default target. Authored literal
transition targets are now checked against the machine topology, and illegal
SCXML multi-target configurations are rejected when the machine is created.

Add a default target to every history state:

```ts
createMachine({
  initial: 'active',
  states: {
    active: {
      initial: 'idle',
      states: {
        idle: {},
        history: {
          type: 'history',
          target: 'idle'
        }
      }
    }
  }
});
```
