---
'xstate': minor
---

Add `setup(...).createInvoke(...)` for typed inline invocations. The helper infers actor input, completion output, errors and snapshots from its `src` logic. Inline calls also infer the enclosing state's narrowed context, state input and transition targets, including alongside registered actor sources.

```ts
invoke: s.createInvoke({
  src: createAsyncLogic({ run: async () => ({ name: 'David' }) }),
  onDone: ({ event }) => ({
    context: { name: event.output.name }
  })
})
```
