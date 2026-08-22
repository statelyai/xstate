---
title: Input and output
description: Pass input to actors and read output when they complete.
---

Input provides data when an actor is created.

```ts
const greetingMachine = createMachine({
  context: ({ input }: { input: { name: string } }) => ({ name: input.name })
});

const greeting = createActor(greetingMachine, {
  input: { name: 'Ada' }
}).start();
```

## Final output

```ts
const machine = createMachine({
  context: { result: 42 },
  initial: 'working',
  states: {
    working: { on: { finish: { target: 'done' } } },
    done: { type: 'final' }
  },
  output: ({ context }) => ({ result: context.result })
});
```

Read output from a completed snapshot or an invocation's done event.

Input configures one actor instance. Output reports its final result.

- An invoice actor can receive a currency and line items as input, then output the calculated total.
- A file-processing actor can receive a file key as input, then output the generated asset URL.

Actors that run indefinitely may never produce output.

## TypeScript

Declare input and output schemas when they cross actor boundaries.

The output type is inferred from the root `output` when `schemas.output` is not declared. A declared `schemas.output` is authoritative and the root `output` is checked against it.

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

// OutputFrom<typeof machine> is { status: 'shipped'; skus: string[] }
```

## Input and output cheatsheet

```ts
context: ({ input }) => ({ value: input.value })
output: ({ context }) => ({ value: context.value })
createActor(machine, { input: { value: 1 } });
```
