---
'xstate': minor
---

An opt-in `createModel()` helper has been introduced to make it easier to work with typed `context` and events.

- `createModel(initialContext)` creates a `model` object
- `model.initialContext` returns the `initialContext`
- `model.assign(assigner, event?)` creates an `assign` action that is properly scoped to the `event` in TypeScript

See https://github.com/davidkpiano/xstate/pull/1439 for more details.

```js
import { createMachine } from 'xstate';
import { createModel } from 'xstate/lib/model'; // opt-in, not part of main build

interface UserContext {
  name: string;
  age: number;
}

type UserEvents =
  | { type: 'updateName'; value: string }
  | { type: 'updateAge'; value: number }

const userModel = createModel<UserContext, UserEvents>({
  name: 'David',
  age: 30
});

const assignName = userModel.assign({
  name: (_, e) => e.value // correctly typed to `string`
}, 'updateName'); // restrict to 'updateName' event

const machine = createMachine<UserContext, UserEvents>({
  context: userModel.context,
  initial: 'active',
  states: {
    active: {
      on: {
        updateName: {
          actions: assignName
        }
      }
    }
  }
});
```
