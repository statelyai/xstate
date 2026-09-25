---
'@xstate/test': minor
---

Added `eventsFromSchemas(machine)`, which derives FastCheck event generators from the event schemas declared on a machine, so the `events` map no longer has to be written by hand:

```ts
import * as z from 'zod';
import { eventsFromSchemas } from '@xstate/test';

const machine = createMachine({
  schemas: {
    events: {
      INC: z.object({ value: z.number().int() }),
      RESET: z.object({})
    }
  }
  // ...
});

await propertyTest(machine, {
  events: eventsFromSchemas(machine),
  invariant: ({ snapshot }) => {
    expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
  }
});
```

Zod (v3 and v4) schemas are supported from `@xstate/test`; for Effect Schemas, import `eventsFromSchemas` from `@xstate/test/effect-schema`. Event types with no declared schema generate `{}`, or can be left out with `{ eventsWithoutSchema: 'skip' }`. Use `mergeEventGenerators(derived, explicit)` to override individual generators.

Declared constraints are honored, so a generator never produces a value its own schema rejects: `z.string().min(1)` never yields `""`, and `z.number().int().min(1).max(5)` only yields integers between 1 and 5. Lengths, numeric ranges, `multipleOf`, `email`, `uuid`, `url`, regexes, `startsWith`/`endsWith`/`includes` and `trim`/`toLowerCase`/`toUpperCase` are all mapped; a check that cannot be mapped throws instead of being silently ignored.
