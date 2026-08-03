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

## TypeScript

Guard arguments are inferred from context and event schemas.

## Guards cheatsheet

```ts
on: {
  submit: {
    guard: ({ context }) => context.isValid,
    target: 'submitting'
  }
}
```
