---
'@xstate/store': major
---

Add Standard Schema support to store configs and `fromStore(...)`.

Schemas can type context, accepted events, and emitted events without enabling runtime validation by default. To validate schema-declared values at runtime, use the new `validateSchemas()` extension from `@xstate/store/validate`.

```ts
import { createStore } from '@xstate/store';
import { validateSchemas } from '@xstate/store/validate';
import { z } from 'zod';

const store = createStore({
  schemas: {
    context: z.object({ count: z.number() }),
    events: {
      increment: z.object({ by: z.number() })
    }
  },
  context: { count: 0 },
  on: {
    increment: (context, event) => ({
      count: context.count + event.by
    })
  }
}).with(validateSchemas());
```
