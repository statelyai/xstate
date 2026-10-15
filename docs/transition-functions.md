---
title: Transition functions and graph analysis
description: Keep typed decisions together while making possible destinations visible.
---

Transition functions keep a decision, its context updates and its effects together. States and their hierarchy remain declarative. You can still use a transition object such as `{ target: 'loading' }`, including `context`, `input` and `reenter`. Conditions and effects move from the v5 `guard` and `actions` properties into the function.

## Why use functions?

- **Type narrowing carries through.** An `if` can narrow context or event data for the updates and effects in that branch. A separately declared action does not automatically inherit a guard callback's narrowing.
- **Conditional effects use ordinary JavaScript.** Use conditions, early returns and shared calculations without additional action combinators.
- **Common effects are written once.** Enqueue an effect before branching when it should run for every selected destination. Check any condition that rejects the event before enqueuing.
- **Effects stay separate from calculation.** `enq(...)` records work for the actor to execute after the next snapshot is resolved.

```ts
import { createActor, createMachine, types } from 'xstate';

type Payment =
  | { method: 'card'; token: string }
  | { method: 'cash' };

const machine = createMachine({
  schemas: {
    context: types<{ submissions: number }>(),
    events: { submit: types<Payment>() }
  },
  context: { submissions: 0 },
  initial: 'editing',
  states: {
    editing: {
      on: {
        submit: ({ context, event }, enq) => {
          const nextContext = { submissions: context.submissions + 1 };
          enq(() => console.log('Submission received'));

          if (event.method === 'card') {
            const token = event.token; // event is narrowed to a card payment
            enq(() => console.log('Charge card', token));
            return { target: 'charging', context: nextContext };
          }

          return { target: 'paid', context: nextContext };
        }
      }
    },
    charging: {},
    paid: {}
  }
});

const actor = createActor(machine).start();
actor.send({ type: 'submit', method: 'card', token: 'payment-token' });
actor.getSnapshot().value; // 'charging'
```

The common effect and next context are computed once. The card branch can safely read `event.token`, and both destination names are explicit.

Purity and graph structure are separate concerns. V5 already supported calculating a next snapshot and effects without running those effects. A function must still be deterministic and keep side effects inside `enq`; being a function does not make it pure.

## What can graph analysis establish?

Three checks answer different questions:

- **Target validity:** does a target refer to an authored state? XState's TypeScript checks cover literal targets. This does not guarantee that a tool has extracted every possible edge.
- **Graph coverage:** does the extracted graph include every possible destination? Explicit objects and supported branches with literal targets make destinations available to source analysis. Computed expressions and unresolved helpers can hide them.
- **Reachability:** can an edge actually be taken for some context and event? Listing an edge does not prove its condition can pass. Arbitrary guard functions limited this analysis in v5 too.

In the example, source analysis can identify `editing → charging` and `editing → paid` without proving which event values will occur. A conservative graph may include edges that are never taken; it must not silently omit possible edges if it claims complete coverage.

The runtime `toDirectedGraph(...)` API does not currently inspect transition function bodies, so it omits their edges. Literal targets inside a function are available only to source-analysis tooling that explicitly supports that syntax. Treat runtime graph output as incomplete when a machine uses transition functions.

## Proposed strict graph extraction

**This is a proposed tooling contract, not a shipped XState option or lint command.** TypeScript's `strict` setting does not enable strict graph extraction. Visual tooling support for v6 is still in progress; see the [FAQ](faq.md#does-stately-studio-or-the-vs-code-extension-support-v6).

A strict analyzer would accept supported forms only when it can establish all possible destinations. Otherwise it would fail linting or CI. For example, replacing the explicit returns above with `return { target: chooseDestination(event), context: nextContext }` would fail if the analyzer could not establish the helper's complete destination set:

```text
Cannot establish all possible destinations for "submit".
Target comes from an unresolved function: chooseDestination(event).
```

This diagnostic is illustrative. A helper is not automatically forbidden: an analyzer that can resolve its implementation or establish a sound finite return set could accept it. Keeping the condition in a helper and the destination literals in the transition is another way to keep the edges visible.

An explicit escape hatch would mark coverage as incomplete. Whether strict checking should be the default is part of the proposal; there is no default strict guarantee today. A complete contract also needs documented supported forms and coverage checks, rather than merely rejecting the unresolved cases a best-effort extractor happens to notice.

For now, keep destination literals visible when graph inspection matters, and check the capabilities of the tooling you use. A visualization or a passing TypeScript check alone is not proof of complete graph coverage.
