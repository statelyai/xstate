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

Return a `context` object from a transition function. XState merges it into the current context at the top level, so keys you omit keep their current values:

```ts
// context before: { count: 0, name: 'Ada' }
increment: ({ context }) => ({ context: { count: context.count + 1 } })
// context after: { count: 1, name: 'Ada' }
```

The merge is shallow. A nested object in the returned patch replaces the current value of that key; spread the nested object yourself to keep its other fields.

Do not mutate the current context. Keep resources that cannot be serialized outside context.

Use context for supporting data, not hidden state. An order can store its items and total in context while its current status stays in states such as `editing`, `paying` and `complete`.

Input creates context for each actor instance. The same machine can run one upload for `report.pdf` and another for `photo.jpg` without closing over either file.

## TypeScript

Context is inferred from its initial value or the return value of a context initializer. Without `schemas.context`, `createMachine({ context: () => ({ count: 0 }) })` still gives `snapshot.context.count` the type `number`. The initializer’s `spawn` returns a typed actor ref. Use a context schema when you need a wider or shared type.

## Typestates

Declare a state-level `schemas.context` to narrow context in that state.
For example, a `loaded` state can require `user: string` while the root
context allows `user: string | null`. `snapshot.matches('loaded')` then
narrows the context type. See [Typestates](typestates.md).

## Context cheatsheet

```ts
context: { count: 0 }
on: {
  increment: ({ context }) => ({
    context: { ...context, count: context.count + 1 }
  })
}
```
