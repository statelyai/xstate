---
'xstate': minor
---

State and transition metadata can now use separate schemas:

```ts
const machine = createMachine({
  schemas: {
    meta: z.object({ label: z.string() }),
    transitionMeta: z.object({ trackingId: z.number() })
  },
  meta: { label: 'Root' },
  on: {
    NEXT: { meta: { trackingId: 42 } }
  }
});
```

When `transitionMeta` is omitted, `schemas.meta` continues to apply its type to
both state and transition metadata.
