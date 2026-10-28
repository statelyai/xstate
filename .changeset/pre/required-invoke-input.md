---
'xstate': major
---

`invoke` requires `input` when the invoked actor logic requires input, matching `createActor(logic, { input })` and `enq.spawn(logic, { input })`. This applies to logic values, registered source names and `src` functions, in `createMachine`, `setup(...).createMachine` and `setup(...).createStateConfig`. Logic whose input type accepts `undefined` (no `schemas.input`, or an optional input schema) can still omit it.

```ts
const child = createMachine({
  schemas: { input: z.object({ userId: z.string() }) }
});

createMachine({
  // Type error: This actor logic requires input. Add an `input` to this invoke.
  invoke: { src: child }
});

createMachine({
  invoke: { src: child, input: ({ context }) => ({ userId: context.userId }) }
});
```

`enq.spawn(logic)` without required input now reports `Expected 2 arguments` instead of a mismatch against the source-name overload.
