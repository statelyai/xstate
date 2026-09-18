---
'@xstate/fast-check': minor
---

Added `eventsFromSchemas(machine)`, which derives FastCheck event generators from the event schemas declared on a machine, so the `events` map no longer has to be written by hand:

```ts
import * as z from 'zod';
import { eventsFromSchemas, fastCheckAdapter } from '@xstate/fast-check';

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
  adapter: fastCheckAdapter(),
  events: eventsFromSchemas(machine),
  invariant: ({ snapshot }) => {
    expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
  }
});
```

Zod (v3 and v4) schemas are supported from `@xstate/fast-check`; for Effect Schemas, import `eventsFromSchemas` from `@xstate/fast-check/effect-schema`. Event types with no declared schema generate `{}`, or can be left out with `{ eventsWithoutSchema: 'skip' }`. Use `mergeEventGenerators(derived, explicit)` to override individual generators.
