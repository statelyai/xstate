---
title: Choice states
description: Branch to one of several targets with a single choice function.
---

A choice state is a pass-through state that immediately picks its own target. It declares `type: 'choice'` and a single `choice` function.

```ts
states: {
  routing: {
    type: 'choice',
    choice: ({ context }) => {
      if (context.isVip) return { target: 'vipFlow' };
      if (context.overBudget) return { target: 'review' };
      return { target: 'standardFlow' };
    }
  },
  vipFlow: {},
  review: {},
  standardFlow: {}
}
```

The machine never rests in `routing`. Entering it runs `choice`, and the returned target is entered in the same step. If `routing` is the initial state, the actor's first snapshot value is already `vipFlow`.

Choice states are entered by targeting them, like any other state. They have no incoming logic of their own.

```ts
idle: { on: { checkout: { target: 'routing' } } }
```

Sending `checkout` enters `routing`, and the machine transitions to the target that `choice` returns.

## What the choice function returns

`choice` returns a target config: `{ target }`, plus optional `description`, `reenter`, `meta` and `input`. The target may be a single state key or an array of keys for parallel regions.

```ts
choice: ({ context, event }) => ({
  target: context.retries > 3 ? 'failed' : 'uploading',
  input: { attempt: context.retries + 1 }
})
```

The function must resolve to a target. Returning `undefined`, or an object without `target`, throws `Choice state "(machine).routing" must resolve to a target.` at the moment the state is entered, not at machine creation. Always end the function with a fallback branch.

A choice cannot enqueue effects or update context: `actions` and `to` on the returned object are rejected. Do the context update on the transition that leads into the choice state.

## Named guards

The choice function receives the same arguments as a [transition](transitions.md) function, including named `guards` from the machine config or [`setup()`](guards.md).

```ts
const machine = createMachine({
  context: { isVip: false, overBudget: false },
  initial: 'routing',
  states: {
    routing: {
      type: 'choice',
      choice: ({ context, guards }) => {
        if (guards.isVip(context)) return { target: 'vipFlow' };
        if (guards.isOverBudget(context)) return { target: 'review' };
        return { target: 'standardFlow' };
      }
    },
    vipFlow: {},
    review: {},
    standardFlow: {}
  },
  guards: {
    isVip: ({ isVip }: { isVip: boolean }) => isVip,
    isOverBudget: ({ overBudget }: { overBudget: boolean }) => overBudget
  }
});
```

## Constraints

A choice state is only a branch point, so it cannot declare anything that would need it to stay resident: `invoke`, `after`, `on`, `entry`, `exit`, `always`, `states`, `initial`, `onDone`, `timeout`, `onTimeout`, `history`, `target` or `output`. Any of these throws <code>Choice state "(machine).routing" cannot declare `invoke`.</code> when the machine is created.

> **Warning:** `choice` only works with `type: 'choice'`. Putting `choice` on an ordinary state throws <code>State "(machine).a" has `choice`, but `choice` can only be used with `type: 'choice'`.</code>, and a state with `type: 'choice'` and no function throws <code>Choice state "(machine).routing" must declare a `choice` function.</code>

Use choice states for:

- routing a checkout to `vipFlow`, `review` or `standardFlow` after the cart is priced
- picking `resume` or `restart` when a media player reloads a saved position
- sending an uploaded file to `imagePipeline`, `videoPipeline` or `rejected` based on its type

Choice states replace v5 chains of transient `always` transitions, keeping the branch logic in one function. Use [`always`](transitions.md) for an eventless transition out of a state the machine rests in. Use a choice state when the state exists only to decide.

## TypeScript

`context`, `event` and `guards` in the choice function are inferred from the machine's [schemas](typescript.md) and named guards. Target strings are checked against sibling state keys, so a typo is a type error. The return type accepts only `{ target, description?, reenter?, meta?, input? }`. It does not include `actions` or context updates.

## Choice states cheatsheet

```ts
states: {
  routing: {
    type: 'choice',
    choice: ({ context, guards }) => {
      if (guards.isVip(context)) return { target: 'vipFlow' };
      return { target: 'standardFlow' }; // fallback: must resolve
    }
  },
  vipFlow: {},
  standardFlow: {}
}
```
