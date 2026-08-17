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

## Input and output cheatsheet

```ts
context: ({ input }) => ({ value: input.value })
output: ({ context }) => ({ value: context.value })
createActor(machine, { input: { value: 1 } });
```
