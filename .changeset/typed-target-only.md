---
'xstate': patch
---

Transition functions may now return only a target when the target state's context is compatible with the current context.

```ts
setup({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      next: types<{}>()
    }
  }
}).createMachine({
  context: { count: 0 },
  initial: 'idle',
  states: {
    idle: {
      on: {
        next: () => ({ target: 'done' })
      }
    },
    done: {}
  }
});
```
