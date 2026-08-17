---
'xstate': minor
---

Allow `setup({ states })` to declare schemas for only the states that need them. Other machine states use the machine's root context type.

Transition context updates now use the root context as the fallback when the target state has no context schema, allowing narrowed states to transition back to wider states.

```ts
const machine = setup({
  states: {
    complete: {
      schemas: { context: z.object({ result: z.string() }) }
    }
  }
}).createMachine({
  initial: 'planning',
  states: {
    planning: {},
    complete: {}
  }
});
```
