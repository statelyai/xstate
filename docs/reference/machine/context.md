---
title: Context
description: Store and update data used by a machine actor.
---

Context stores data that does not determine the current state by itself.

```ts
const machine = createMachine({ context: { count: 0, name: '' } });
```

## Lazy initial context

```ts
context: ({ input }: { input: { name: string } }) => ({
  count: 0,
  name: input.name
})
```

## Update context

Return the complete next context from a transition function.

```ts
increment: ({ context }) => ({
  context: { ...context, count: context.count + 1 }
})
```

Do not mutate the current context. Keep resources that cannot be serialized outside context.

Use context for supporting data, not hidden state. An order can store its items and total in context while its current status stays in states such as `editing`, `paying` and `complete`.

Input creates context for each actor instance. The same machine can run one upload for `report.pdf` and another for `photo.jpg` without closing over either file.

## TypeScript

Context is inferred from its initial value. Use a context schema when you need a wider or shared type.

## Context cheatsheet

```ts
context: { count: 0 }
on: {
  increment: ({ context }) => ({
    context: { ...context, count: context.count + 1 }
  })
}
```
