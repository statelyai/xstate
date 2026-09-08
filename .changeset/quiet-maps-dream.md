---
'xstate': minor
---

State and transition metadata can now use separate types:

```ts
const machine = setup({
  types: {
    stateMeta: {} as { label: string },
    transitionMeta: {} as { trackingId: number }
  }
}).createMachine({
  meta: { label: 'Root' },
  on: {
    NEXT: { meta: { trackingId: 42 } }
  }
});
```

The existing `types.meta` field remains supported and applies its type to both
state and transition metadata.
