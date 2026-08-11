---
'xstate': minor
---

Expose `machine.schemas` as a public runtime-readable schema contract.

```ts
const machine = createMachine({
  schemas: {
    context: z.object({ count: z.number() }),
    events: {
      inc: z.object({ by: z.number() })
    }
  },
  context: { count: 0 }
});

machine.schemas?.events?.inc;
```
