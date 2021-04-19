---
'xstate': patch
---

Add `assertEvent()` helper.

Example:

```typescript
import { assign, createMachine, ExtractEvent } from 'xstate';
import { assertEvent } from 'xstate/lib/assertEvent';

type Context = {
  date: Date;
};

type Event = { type: 'SHOW_DATE' } | { type: 'UPDATE_DATE'; date: Date };

const machine = createMachine<Context, Event>(
  {
    on: {
      SHOW_DATE: { actions: 'showDate' },
      UPDATE_DATE: { actions: 'updateDate' }
    }
  },
  {
    actions: {
      showDate: (ctx, e) => {
        assertEvent(e, 'SHOW_DATE');
        alert(ctx.date.toISOString());
      },
      updateDate: assign({
        date: (_, e) => {
          assertEvent(e, 'UPDATE_DATE');
          return e.date; // has type "Date"
        }
      })
    }
  }
);
```
