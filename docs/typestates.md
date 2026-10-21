---
title: Typestates
description: Narrow context according to the active state.
---

Typestates describe which context values are valid in each state. For example,
a request can have `user: null` while idle and `user: string` after loading.
XState v6 derives these types from state-level `schemas.context` declarations,
instead of the manually declared `Typestate` generic used in v4.

## Declare context per state

<!-- state context refinements and target patches from packages/core/test/stateInput.test.ts -->

Declare the root context and each state's refinements in `setup(...)`:

```ts
import { createActor, setup, types } from 'xstate';

const machine = setup({
  schemas: {
    context: types<{ requestId: string; user: string | null }>(),
    events: { load: types<{ name: string }>() }
  },
  states: {
    idle: { schemas: { context: types<{ user: null }>() } },
    loaded: { schemas: { context: types<{ user: string }>() } }
  }
}).createMachine({
  context: { requestId: 'request-1', user: null },
  initial: 'idle',
  states: {
    idle: {
      on: {
        load: ({ event }) => ({
          target: 'loaded',
          context: { user: event.name }
        })
      }
    },
    loaded: {
      entry: ({ context }, enq) => {
        enq(() => console.log(context.user.toUpperCase()));
      }
    }
  }
});

const actor = createActor(machine).start();
const snapshot = actor.getSnapshot();
snapshot.context.user; // string | null

if (snapshot.matches('loaded')) {
  snapshot.context.user; // string
  snapshot.context.requestId; // string
}
```

State schemas refine the root context type by intersection. They only need to
declare the fields they narrow; other root fields remain available. A state
schema cannot widen a root field or give it an incompatible type.

`types<T>()` declares a TypeScript contract without runtime validation. Use Zod
or another Standard Schema library when you also need runtime checks.

## Enter a state with valid context

Actions and transition functions declared on a state receive that state's
narrowed context. When a transition's target requires a refinement the source
context does not already satisfy, the transition must provide a matching
`context` patch. In the example, entering `loaded` from `idle` requires
`user: string`; omitting the patch or supplying `user: null` is a type error.

Context patches merge at the top level. The transition only changes `user`;
`requestId` keeps its current value. See [context updates](context.md#update-context).

## Narrow a snapshot

Use `snapshot.matches(...)` to narrow context when reading an actor snapshot.
For a checkout machine with a nested `reviewing` state, pass a nested state value:

```ts
if (checkoutSnapshot.matches({ checkout: 'reviewing' })) {
  // Context includes the checkout and reviewing state refinements.
}
```

Nested states retain refinements from active ancestors. For parallel states,
`matches(...)` combines refinements for the regions named in the matched value.
An omitted region does not gain a refinement from that check.

Typestates refine context; they do not identify the event that entered a state.
An `entry` or `exit` function can receive multiple event types. Use
`assertEvent(...)` when it needs one particular event.
An `on.load` transition already receives the narrowed `load` event.

## Runtime validation

Schemas infer types by default. To check values at runtime, install
`standardSchemaValidator()` from `xstate/validation` on the setup. XState then
validates stable context against the root schema and every active state schema
before running effects. Nested state refinements are checked alongside their
ancestor schemas.

Validation is opt-in and assertion-only. `types<T>()` cannot validate values,
and runtime schemas that transform values or validate asynchronously are
unsupported. See [runtime validation](typescript.md#runtime-validation).

Typestates do not validate a persisted snapshot during restoration. Validate
stored data before restoring it; see [persistence](persistence.md).
