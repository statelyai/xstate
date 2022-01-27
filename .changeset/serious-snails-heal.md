---
'xstate': patch
---

Added `t()`, which can be used to provide types for `schema` attributes in machine configs:

```ts
import { t, createMachine } from 'xstate';

const machine = createMachine({
  schema: {
    context: t<{ value: number }>(),
    events: t<{ type: 'EVENT_1' } | { type: 'EVENT_2' }>()
  }
});
```
