---
'xstate': patch
---

Fixed a bug where an invoked actor's `input` (and a dynamic `src` function) received the context from _before_ the transition that entered the invoking state, rather than the updated context. Now, when a transition updates context and targets a state that invokes an actor, the actor's `input` sees the updated context — consistent with that state's `entry` actions.

```ts
const machine = createMachine({
  context: { value: 0 },
  initial: 'idle',
  states: {
    idle: {
      on: {
        start: () => ({ target: 'active', context: { value: 100 } })
      }
    },
    active: {
      invoke: {
        src: asyncLogic,
        // now receives { value: 100 } instead of { value: 0 }
        input: ({ context }) => ({ val: context.value })
      }
    }
  }
});
```
