---
'xstate': patch
---

Transition functions may now return only a target when the target state's context is compatible with the current context. Returned `context` values from transition functions and entry/exit actions can also be shallow patches when omitted top-level keys are safe to preserve. If a target state narrows `schemas.context`, the returned patch must still include any keys needed to satisfy that target context.

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

```ts
setup({
  schemas: {
    context: types<{ a: number; b: number; c: number }>(),
    events: {
      next: types<{}>()
    }
  }
}).createMachine({
  context: { a: 1, b: 2, c: 3 },
  initial: 'idle',
  states: {
    idle: {
      on: {
        next: ({ context }) => ({
          target: 'done',
          context: { a: context.a + 1 }
        })
      }
    },
    done: {}
  }
});
```
