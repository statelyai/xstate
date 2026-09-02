---
'xstate': minor
---

State-level context schemas now refine the root context schema instead of
replacing it. Declare only the fields narrowed by a state while retaining all
root context fields in state actions, transitions, and narrowed snapshots.

```ts
const machine = setup({
  schemas: {
    context: z.object({
      requestId: z.string(),
      draft: z.string().optional()
    })
  },
  states: {
    reviewing: {
      schemas: { context: z.object({ draft: z.string() }) }
    }
  }
}).createMachine({
  context: { requestId: 'req-1' },
  // ...
});
```
