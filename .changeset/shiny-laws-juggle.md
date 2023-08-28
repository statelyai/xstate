---
'xstate': minor
---

The `stateNode` where an action or guard originates can now be read in the action or guard's provided implementation, or inline:

```ts
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      meta: { message: 'I am idle', enabled: true },

      entry: ({ stateNode }) => {
        stateNode.message; // 'I am idle'
      },

      on: {
        someEvent: {
          guard: ({ stateNode }) => {
            return stateNode.enabled; // true
          }
        }
      }
    }
  }
});
```
