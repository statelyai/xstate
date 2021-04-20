---
'xstate': patch
---

Add `assertEvent()` helper that throws an exception when the given event is not of the expected type.

This is usefull to type-narrow events inside actions, and make sure that expected data exists on an event object.

Example:

```typescript
import { assign, createMachine, ExtractEvent } from 'xstate';
import { assertEvent } from 'xstate/lib/assertEvent';

type Context = {
  date: Date;
};

type Event =
  | { type: 'SHOW_DATE' }
  | { type: 'NEW_DATE'; date: Date }
  | { type: 'UPDATE_DATE'; date: Date }

const machine = createMachine<Context, Event>(
  context: {
    date: new Date(),
  },
  {
    on: {
      SHOW_DATE: { actions: 'showDate' },
      NEW_DATE: { actions: 'assignDate' }
      UPDATE_DATE: { actions: 'assignDate' }
    }
  },
  {
    actions: {
      showDate: (ctx, event) => {
        assertEvent(event, 'SHOW_DATE');
        alert(ctx.date.toISOString());
      },
      assignDate: assign({
        date: (_, event) => {
          assertEvent(event, ['NEW_DATE', 'UPDATE_DATE']);
          return event.date; // has type "Date"
        }
      })
    }
  }
);
```
