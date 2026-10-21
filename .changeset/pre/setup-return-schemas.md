---
'xstate': minor
---

`setup(...)` now exposes the schemas defined in its configuration, making them accessible for external use.

```ts
import { setup, types } from 'xstate';

const s = setup({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      inc: types<{ by: number }>()
    },
    emitted: {
      changed: types<{ value: number }>()
    }
  }
});

s.schemas.context;
s.schemas.events.inc;
s.schemas.emitted.changed;
```
