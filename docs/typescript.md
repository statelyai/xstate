---
title: TypeScript
description: Define schemas and derive XState types.
---

Define schemas with `setup(...)`. XState infers context, events, input and output from them.

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
