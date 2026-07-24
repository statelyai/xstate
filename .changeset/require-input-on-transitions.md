---
'xstate': minor
---

Transitions that target a state declaring `schemas.input` now **require** an `input` property, enforced at the type level. This applies to `on`, `always`, `after`, `onTimeout`, `onDone`, `onError`, invoke handlers, and the object form of `initial`.

```ts
const machine = setup({
  states: {
    loading: {
      schemas: { input: z.object({ userId: z.string() }) }
    }
  }
}).createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        // Before: LOAD: { target: 'loading' }  — now a type error
        LOAD: { target: 'loading', input: { userId: 'user-1' } }
      }
    },
    loading: {}
  }
});
```
