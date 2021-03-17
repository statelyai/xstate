---
'xstate': minor
---

Event creators can now be modeled inside of the 2nd argument of `createModel()`, and types for both `context` and `events` will be inferred properly in `createMachine()` when given the `typeof model` as the first generic parameter.

```ts
import { createModel } from 'xstate/lib/model';

const userModel = createModel(
  // initial context
  {
    name: 'David',
    age: 30
  },
  // creators (just events for now)
  {
    events: {
      updateName: (value: string) => ({ value }),
      updateAge: (value: number) => ({ value }),
      anotherEvent: () => ({}) // no payload
    }
  }
);

const machine = createMachine<typeof userModel>({
  context: userModel.initialContext,
  initial: 'active',
  states: {
    active: {
      on: {
        updateName: {
          /* ... */
        },
        updateAge: {
          /* ... */
        }
      }
    }
  }
});

const nextState = machine.transition(
  undefined,
  userModel.events.updateName('David')
);
```
