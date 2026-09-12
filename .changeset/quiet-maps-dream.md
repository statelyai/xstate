---
'xstate': minor
---

State and transition metadata can now use separate types:

```ts
const machine = setup({
  types: {
    meta: {} as { label: string },
    transitionMeta: {} as { trackingId: number }
  }
}).createMachine({
  meta: { label: 'Root' },
  on: {
    NEXT: { meta: { trackingId: 42 } }
  }
});
```

When `transitionMeta` is omitted, `types.meta` continues to apply its type to
both state and transition metadata.
