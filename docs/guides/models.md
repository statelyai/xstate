# Models

In XState, you can model a machine's `context` and `events` externally by using `createModel(...)`. This provides a convenient way to strongly type `context` and `events`, as well as helpers for event creation, assignment and other implementation details in the future.

## `createModel(...)`

The `createModel(...)` function takes

| Argument              | Type   | Description                                                |
| --------------------- | ------ | ---------------------------------------------------------- |
| `initialContext`      | object | The initial `context` value                                |
| `creators` (optional) | object | An object containing various creators (currently `events`) |

The `creators` object includes the following properties:

| Argument | Type   | Description                         |
| -------- | ------ | ----------------------------------- |
| `events` | object | An object containing event creators |

The keys of the `creators.events` object are event types, and the values are functions that accept any number of arguments and return the event payload.

## Modeling context

Since the model defines the machine's `context`, the model can be used within the machine definition to set its initial `context` with `model.initialContext` and to update the machine's `context` with `model.assign`.

The `model.assign` function is typed to the shape of the model's `context`, making it a convenient and type-safe replacement for the `assign` action.

```js
import { createModel } from 'xstate/lib/model';

const userModel = createModel({
  name: 'Someone',
  age: 0
});

// ...

const machine = createMachine({
  context: userModel.initialContext,
  // ...
  entry: userModel.assign({ name: '' })
});
```

## Modeling events

```ts
import { createModel } from 'xstate/lib/model';

const userModel = createModel(
  // Initial context
  {
    name: 'David',
    age: 30
  },
  {
    // Event creators
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
          actions: userModel.assign({
            name: (_, event) => event.value // inferred
          })
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
