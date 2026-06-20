---
'xstate': major
---

`schemas` is now the way to type a machine, replacing v5's `types: {} as {...}`. Each `schemas` field accepts any [Standard Schema](https://standardschema.dev) (Zod, Valibot, …) for both type inference and (where supported) runtime validation, or `types<T>()` for types only.

Notably, `schemas.events` is a **map** of event-type → payload schema, inferred into a discriminated union keyed by `type`:

```ts
import { createMachine } from 'xstate';
import { z } from 'zod';

const machine = createMachine({
  schemas: {
    context: z.object({ count: z.number() }),
    events: {
      inc: z.object({ by: z.number() }),
      reset: z.object({})
    },
    input: z.object({ start: z.number() }),
    output: z.object({ total: z.number() }),
    emitted: { changed: z.object({ count: z.number() }) },
    tags: z.union([z.literal('busy'), z.literal('idle')]),
    meta: z.object({ label: z.string() })
  },
  context: ({ input }) => ({ count: input.start }),
  initial: 'active',
  states: {
    active: {
      on: {
        inc: ({ context, event }) => ({
          context: { count: context.count + event.by }
        })
      }
    }
  }
});
```

- `context` → context type (literal initial values are widened, so updates typecheck).
- `events` → `{ type: 'inc'; by: number } | { type: 'reset' }`; payloads are typed on `event` in every transition/action/guard function.
- `input` → typed `createActor(machine, { input })` and the `context` initializer argument.
- `output` → typed `snapshot.output`.
- `emitted` → typed `actor.on('changed', (ev) => ev.count)`.
- `tags` → constrains `snapshot.hasTag(...)`.
- `meta` → typed state `meta`.

`actors`, `actions`, `guards`, and `delays` are top-level config keys (now inline functions), not `schemas` keys.
