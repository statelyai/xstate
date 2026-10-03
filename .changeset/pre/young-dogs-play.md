---
'xstate': minor
---

Add `setup(...).createInvoke(...)` for typed inline invocations. The helper infers actor input, completion output, errors and snapshots from its `src` logic. Async functions can be authored directly in `src`, with optional `schemas.input`, `schemas.output` and `schemas.error`. Without an output schema, completion output is inferred from the async return value. Inline calls also infer the enclosing state's narrowed context, state input and transition targets, including alongside registered actor sources.

Actors whose input excludes `undefined` require an input value or mapper. Invokes check their child IDs and source compatibility against `schemas.children` declared in either the setup or machine.

```ts
invoke: s.createInvoke({
  schemas: { input: types<{ userId: string }>() },
  input: ({ context }) => ({ userId: context.userId }),
  src: async ({ input }) => ({ name: input.userId }),
  onDone: ({ event }) => ({
    context: { name: event.output.name }
  })
})
```
