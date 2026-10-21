---
'xstate': patch
---

Optional event payload fields declared with `types()` are now preserved instead of being made required:

```ts
const machine = setup({
  schemas: {
    events: {
      submit: types<{ email: string; referrer?: string }>()
    }
  }
}).createMachine({
  // ...
});

// referrer can now be omitted
actor.send({ type: 'submit', email: 'a@b.co' });
```

Payloads inferred from validator libraries (e.g. Zod) are still wrapped in `Required<>`.
