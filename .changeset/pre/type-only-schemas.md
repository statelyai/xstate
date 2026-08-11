---
'xstate': minor
---

Add `types<T>()` for type-only schemas — declare machine types without a runtime schema library.

`schemas` fields accept any [Standard Schema](https://standardschema.dev) (Zod, Valibot, …) for runtime validation _and_ inference. When you only want types, `types<T>()` provides the inference with no runtime validation (it's a Standard Schema whose validation is the identity function):

```ts
import { createMachine, types } from 'xstate';

const machine = createMachine({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      inc: types<{ by: number }>(),
      reset: types<{}>()
    }
  },
  context: { count: 0 },
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

This is the v6 replacement for v5's `types: {} as { ... }` — same "types only, no runtime cost" intent, now living in `schemas` alongside real schemas. `isTypeSchema(value)` is also exported.
