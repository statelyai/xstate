---
'xstate': patch
---

Delayed transitions (`onTimeout` and `after`) in machines created with `setup({ states })` now type the `context` patch against the **target** state's context schema, matching the behavior of `on:` transitions. Previously, a cross-state context patch that was valid at runtime failed to typecheck:

```ts
const machine = setup({
  schemas: {
    context: z.object({ reason: z.union([z.literal('timeout'), z.null()]) })
  },
  states: {
    running: { schemas: { context: z.object({ reason: z.null() }) } },
    expired: {
      schemas: { context: z.object({ reason: z.literal('timeout') }) }
    }
  }
}).createMachine({
  context: { reason: null },
  initial: 'running',
  states: {
    running: {
      timeout: 5000,
      // Previously a type error; now checked against `expired`'s context
      onTimeout: () => ({
        target: 'expired',
        context: { reason: 'timeout' as const }
      })
    },
    expired: { type: 'final' }
  }
});
```
