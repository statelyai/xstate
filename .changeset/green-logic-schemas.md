---
'xstate': minor
---

Logic creators now accept Standard Schemas for type inference.

`createLogic(...)` and `createAsyncLogic(...)` accept `schemas.input` and
`schemas.output`:

```ts
const loadUser = createAsyncLogic({
  schemas: {
    input: z.object({ userId: z.string() }),
    output: z.object({ name: z.string() })
  },
  run: async ({ input }) => {
    input.userId; // string

    return {
      name: 'David'
    };
  }
});
```

The schemas are type-only for now. Runtime validation will be added later as an opt-in behavior.

`createCallbackLogic(...)`, `createObservableLogic(...)`, and `createEventObservableLogic(...)` also accept `schemas.input` with object-form config:

```ts
const logic = createCallbackLogic({
  schemas: {
    input: z.object({ userId: z.string() })
  },
  run: ({ input }) => {
    input.userId; // string
  }
});
```
