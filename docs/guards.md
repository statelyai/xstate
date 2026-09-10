---
title: Guards
description: Allow a transition only when a condition passes.
---

A guard is a condition checked inside a transition function. Return a target when the condition passes. Return `undefined` to leave the event unhandled.

```ts
submit: ({ context }) => {
  if (!context.isValid) return;
  return { target: 'submitting' };
}
```

When the function returns `undefined`, the transition is not taken, the state does not change, and no effects run.

## Choosing between targets

One event has one transition function. Return the first matching target and end with the fallback.

```ts
submit: ({ context }) => {
  if (context.role === 'admin') return { target: 'adminReview' };
  return { target: 'standardReview' };
}
```

Plain `if`/`return` statements replace v5's guarded transition arrays and `and`/`or`/`not` combinators. Combine conditions with `&&`, `||`, and `!`.

Guards must be synchronous and free of side effects. Check conditions before enqueuing effects, and keep the function deterministic.

Use guards for rules such as:

- only submit a form when its required fields are valid
- only approve a refund when the amount is within the operator's limit

Do not fetch data in a guard. Invoke an actor, store the result in context, then guard on that result.

## Named guards

Define reusable guards on `setup(...)` or the machine's `guards`. A named guard is a plain predicate function: it receives only the arguments you pass it and knows nothing about the machine. The caller decides what the guard sees — pass values from `context` or the event explicitly.

```ts
const orderMachine = createMachine({
  context: { available: 0, quantity: 0, limit: 10 },
  guards: {
    hasStock: (available: number, quantity: number) => available >= quantity,
    isBelow: (quantity: number, limit: number) => quantity < limit
  },
  initial: 'browsing',
  states: {
    browsing: {
      on: {
        addItem: ({ context, guards }) => {
          if (!guards.hasStock(context.available, context.quantity)) return;
          if (!guards.isBelow(context.quantity, context.limit)) return;
          return { target: 'adding' };
        }
      }
    },
    adding: {}
  }
});
```

Named guards keep a rule's name visible in the machine and let [`machine.provide(...)`](setup-and-provide.md) replace the implementation in tests.

## Checking other states

Use `checkStateIn(...)` to test whether the machine is currently in another state, such as a sibling region of a parallel state.

```ts
import { checkStateIn } from 'xstate';

approve: ({ context, self }) => {
  if (context.isAdmin && !checkStateIn(self.getSnapshot(), 'locked')) {
    return { target: 'approved' };
  }
}
```

`checkStateIn(snapshot, value)` accepts a state id (`'#locked'`), a path (`'security.locked'`), or a state-value object.

## TypeScript

Guard conditions are checked wherever the transition function's `context` and `event` are typed, so a condition that reads a field the schemas do not declare is a type error. Named guards are typed on the `guards` argument exactly as declared, and `schemas.guards` can declare param types before the implementations exist. See [setup and provide](setup-and-provide.md).

## Guards cheatsheet

```ts
// inline guard: return undefined to reject the event
on: {
  submit: ({ context }) => {
    if (!context.isValid) return;
    return { target: 'submitting' };
  }
}

// branching
on: {
  submit: ({ context }) => {
    if (context.role === 'admin') return { target: 'adminReview' };
    return { target: 'standardReview' };
  }
}

// named guard: a plain predicate; pass it what it needs
guards: { isReady: (ready: boolean) => ready }
on: {
  start: ({ context, guards }) => {
    if (guards.isReady(context.ready)) return { target: 'active' };
  }
}
```
