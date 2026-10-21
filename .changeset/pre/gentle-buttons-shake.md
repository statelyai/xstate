---
'xstate': patch
---

A machine's output type is now inferred from its `output` config when no `schemas.output` is declared. A declared `schemas.output` stays authoritative.

```ts
const machine = setup({}).createMachine({
  context: { shipped: ['sku-1'] },
  initial: 'done',
  states: { done: { type: 'final' } },
  output: ({ context }) => ({
    status: 'shipped' as const,
    skus: context.shipped
  })
});

// OutputFrom<typeof machine> is now
// { status: 'shipped'; skus: string[] } instead of {}
```
