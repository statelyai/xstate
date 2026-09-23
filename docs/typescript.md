---
title: TypeScript
description: Define schemas and derive XState types.
---

Define schemas with `setup(...)`. XState infers context, events, input and output from them. State contracts can additionally declare state-node structure and defaults, including `type`, `initial`, `history`, `target` and `id`.

Enable TypeScript's `strict` mode. Keep schemas next to actor logic so runtime validation and inferred types describe the same contract.

```ts
import { z } from 'zod';
import { setup } from 'xstate';

const machine = setup({
  schemas: {
    context: z.object({ count: z.number() }),
    events: {
      increment: z.object({})
    },
    internalEvents: {
      tick: z.object({ count: z.number() })
    },
    input: z.object({ initialCount: z.number() })
  }
}).createMachine({
  context: ({ input }) => ({ count: input.initialCount }),
  initial: 'active',
  states: { active: {} }
});
```

Structural state contracts are checked only when declared. For example,
`type: 'parallel'` forbids `initial`, while `type: 'compound'` requires one.
`setup(...)` can supply those defaults, so the machine config may omit them.
Existing setups that declare only schemas keep their permissive machine-config
typing. A state-level `schemas.context` is intersected with the root context
schema, so it can declare only the fields that state narrows.

Public schema event keys create typed methods on `actor.trigger`; internal
schema keys do not appear in the public trigger namespace.

```ts
actor.trigger.increment();
```

Event types narrow inside transitions:

```ts
on: {
  search: ({ event }) => {
    event.query; // string
  }
}
```

Use `assertEvent(...)` only when shared code must narrow a union to one or more known event types.

## Checked event keys

When `schemas.events` is declared, each key in an `on` map must match a
declared event type. Wildcards (`'*'`, `'user.*'`) and reserved `xstate.*`
event types are always allowed. Without `schemas.events`, any key is accepted.

```ts
on: {
  toggel: { target: 'active' }
  // Type error: Event type 'toggel' is not declared in schemas.events.
}
```

Machines returned by `setup(...).createMachine(...)` can be exported with their
inferred types, including when registered actors are used in inline transitions
or invokes. Declaration output retains event, state, input and child-actor
contracts without exposing each inline callback's full contextual type.

## Child completion events

Children declared in `schemas.children` add their `xstate.done.actor` and
`xstate.error.actor` events to the event union seen by `entry`, `exit`, guards
and transition functions. `event.actorId` is the declared child id, and
`event.output` is that child's output type:

```ts
entry: ({ event }) => {
  assertEvent(event, 'xstate.done.actor');
  event.actorId; // 'fetch'
  event.output; // output of the logic declared for `fetch`
}
```

Without `schemas.children`, these events are not added. `on` handlers still
narrow to their own event type.

## Async logic errors

`createAsyncLogic({ schemas: { error } })` types the actor's `error` snapshot
field and `event.error` in the invoking machine's `onError`. The schema is
type-only. Without it, the error is `unknown`:

```ts
const fetchUser = createAsyncLogic({
  schemas: { error: z.object({ code: z.string() }) },
  run: async () => ({ name: 'David' })
});

// in an invoke of fetchUser
onError: ({ event }) => event.error.code; // string
```

## Checked delay names

When delays are declared with `setup({ delays })` or `createMachine({ delays })`,
each `after` key must be a declared delay name, a number of milliseconds, or a
duration string such as `'5s'`. Without declared delays, any key is accepted.

```ts
after: {
  retryDelya: { target: 'retrying' }
  // Type error: Delay 'retryDelya' is not declared in delays.
}
```

## Runtime validation

<!-- runtime validation API and boundaries from packages/core/src/validation.types.ts, packages/core/src/validation/index.ts, and packages/core/src/setup.ts -->

Runtime validation is opt-in. Install the Standard Schema validator from the
separate `xstate/validation` entry point:

```ts
import { setup } from 'xstate';
import { standardSchemaValidator } from 'xstate/validation';
import { z } from 'zod';

const machine = setup({
  validator: standardSchemaValidator(),
  schemas: {
    input: z.object({ initialCount: z.number() }),
    context: z.object({ count: z.number() }),
    events: {
      increment: z.object({ by: z.number() })
    },
    internalEvents: {
      tick: z.object({ count: z.number() })
    }
  }
}).createMachine({
  context: ({ input }) => ({ count: input.initialCount })
});
```

The validator checks input and public or internal events before calculation, then checks
stable context, active state schemas, child slots, delayed raised events,
emitted events and final output before effects run. Invalid values throw an
`ActorValidationError`.

Validation is synchronous and assertion-only: schema transformations and async
validation are rejected. Unknown events and emitted events are errors when a
corresponding schema map exists; use `unknownEvents: 'ignore'` or
`unknownEmitted: 'ignore'` for open protocols.

Derived setups inherit the validator. Replace it or use `validator: undefined`
to disable it. Persistence, restoration, immediate raised events, action and
guard parameters, static meta and tags, and `snapshot.can()` are not validation
boundaries.

## Type helpers

| Helper | Derives |
| --- | --- |
| `ActorRefFrom<T>` | Actor reference type. |
| `SnapshotFrom<T>` | Snapshot type. |
| `EventFromLogic<T>` | Accepted event type. |
| `InputFrom<T>` | Input type. |
| `OutputFrom<T>` | Final output type. |

## TypeScript cheatsheet

```ts
type Actor = ActorRefFrom<typeof machine>;
type Snapshot = SnapshotFrom<typeof machine>;
type Event = EventFromLogic<typeof machine>;
type Input = InputFrom<typeof machine>;
type Output = OutputFrom<typeof machine>;
```
