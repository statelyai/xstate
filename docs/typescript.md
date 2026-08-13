---
title: TypeScript
description: Define schemas and derive XState types.
---

Define runtime schemas with `setup(...)`. XState infers context, events, input and output from them.

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
    input: z.object({ initialCount: z.number() })
  }
}).createMachine({
  context: ({ input }) => ({ count: input.initialCount }),
  initial: 'active',
  states: { active: {} }
});
```

Schema event keys also create typed methods on `actor.trigger`.

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
