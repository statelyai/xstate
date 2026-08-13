---
title: Guards
description: Allow a transition only when a condition passes.
---

A guard is a synchronous condition on a transition.

```ts
submit: {
  guard: ({ context }) => context.isValid,
  target: 'submitting'
}
```

## Multiple guarded transitions

```ts
submit: [
  { guard: ({ context }) => context.role === 'admin', target: 'adminReview' },
  { target: 'standardReview' }
]
```

Transitions are checked in order. Put the fallback last. Named guards can be defined with `setup(...)` and referenced by name.

Guards must be synchronous and free of side effects.

Use guards for rules such as:

- only submit a form when its required fields are valid
- only approve a refund when the amount is within the operator's limit

Do not fetch data in a guard. Invoke an actor, store the result in context, then guard on that result.

Define reusable guards with `setup(...)` so their names and inputs are checked.

```ts
const orderSetup = setup({
  guards: {
    hasStock: ({ context }) => context.available >= context.quantity
  }
});
```

## TypeScript

Guard arguments are inferred from context and event schemas.

## Guards cheatsheet

```ts
on: {
  submit: [
    { guard: ({ context }) => context.isValid, target: 'submitting' },
    { target: 'invalid' }
  ]
}
```
