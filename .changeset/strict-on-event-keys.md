---
'xstate': minor
---

When `schemas.events` is declared, every key in a state's `on` map must match a declared event type. Wildcards (`'*'`, `'user.*'`) and reserved `xstate.*` event types remain allowed. Machines without `schemas.events` are unchanged.

```ts
setup({
  schemas: { events: { toggle: z.object({}) } }
}).createMachine({
  on: {
    // Type error: Event type 'toggel' is not declared in schemas.events.
    toggel: { target: '.active' }
  }
});
```

Fix the typo, or declare the event in `schemas.events`.
