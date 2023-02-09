# Models

::: warning

The `createModel(...)` function is deprecated and will be removed in XState version 5. It is recommended to use [Typegen](https://stately.ai/blog/introducing-typescript-typegen-for-xstate) instead.

:::

In XState, you can model a machine's `context` and `events` externally by using `createModel(...)`. This provides a convenient way to strongly type `context` and `events`, as well as helpers for event creation, assignment and other implementation details in the future.

Using `createModel(...)` is _completely optional_, and is meant to improve the developer experience. The main reasons for using it are:

- Separating and organizing `context` and `events` in a strongly-typed way
- Preventing typing issues with `assign(...)`
- Specifying event creators for easier and safer event creation
- Potentially sharing the model with other machines
- Future developer experience improvements, such as specifying actions, guards, etc.

## `createModel(...)`

The `createModel(...)` function takes

| Argument              | Type   | Description                                 |
| --------------------- | ------ | ------------------------------------------- |
| `initialContext`      | object | The initial `context` value                 |
| `creators` (optional) | object | An object containing various event creators |

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

const machine = userModel.createMachine({
  context: userModel.initialContext,
  // ...
  entry: userModel.assign({ name: '' })
});
```

## Modeling events

Modeling machine events in a model gives two benefits:

- Events can be created by calling `model.events.eventName(...)`
- Provides type information to the machine definition, providing event-specific type safety for action definitions

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
      updateName: (value) => ({ value }),
      updateAge: (value) => ({ value }),
      anotherEvent: () => ({}) // no payload
    }
  }
);

const machine = userModel.createMachine(
  {
    context: userModel.initialContext,
    initial: 'active',
    states: {
      active: {
        on: {
          updateName: {
            actions: userModel.assign({
              name: (_, event) => event.value
            })
          },
          updateAge: {
            actions: 'assignAge'
          }
        }
      }
    }
  },
  {
    actions: {
      assignAge: userModel.assign({
        age: (_, event) => event.value
      })
    }
  }
);

// This sends the following event:
// {
//   type: 'updateName',
//   value: 'David'
// }
const nextState = machine.transition(
  undefined,
  userModel.events.updateName('David')
);
```

## TypeScript

The `createModel(...)` function infers the following types:

- `context` is inferred from the first argument in `createModel(initialContext, creators)`
- `events` is inferred from `creators.events` in `createModel(initialContext, creators)`

```ts
import { createModel } from 'xstate/lib/model';

const userModel = createModel(
  {
    name: 'David', // inferred as `string`
    age: 30, // inferred as `number`
    friends: [] as string[] // explicit type
  },
  {
    events: {
      updateName: (value: string) => ({ value }),
      updateAge: (value: number) => ({ value }),
      anotherEvent: () => ({}) // no payload
    }
  }
);

// Context inferred as:
// {
//   name: string;
//   age: number;
//   friends: string[];
// }

// Events inferred as:
// | { type: 'updateName'; value: string; }
// | { type: 'updateAge'; value: number; }
// | { type: 'anotherEvent'; }
```

### Creating a machine from a model

Instead of specifying the type of `context` and `event` explicitly as type parameters in `createMachine<TContext, TEvent>(...)`, the `model.createMachine(...)` method should be used:

```ts {0}
const machine = userModel.createMachine({
  context: userModel.initialContext,
  initial: 'active',
  states: {
    active: {
      on: {
        updateName: {
          actions: userModel.assign({
            name: (_, event) => event.value // inferred
          })
        }
      }
    }
  }
});
```

### Narrowing assign event types

When an `assign()` action is referenced in `options.actions`, you can narrow the event type that the action accepts in the 2nd argument of `model.assign(assignments, eventType)`:

```ts
const assignAge = userModel.assign(
  {
    // The `event.type` here is restricted to "updateAge"
    age: (_, event) => event.value // inferred as `number`
  },
  'updateAge' // Restricts the `event` allowed by the "assignAge" action
);

const machine = userModel.createMachine({
  context: userModel.initialContext,
  initial: 'active',
  states: {
    active: {
      on: {
        updateAge: {
          actions: assignAge
        }
      }
    }
  }
});
```

::: warning
Assign actions with narrowed event types _cannot_ be placed inside the `actions: {...}` property of machine options in `createMachine(configuration, options)`. This is because actions in `options.actions` should be assumed to potentially receive _any_ event, even if the machine configuration suggests otherwise.
:::

### Extracting types from model

_Since 4.22.1_

You can extract `context` and `event` types from a model using the `ContextFrom<T>` and `EventFrom<T>` types:

```ts {1,15-16}
import { ContextFrom, EventFrom } from 'xstate';
import { createModel } from 'xstate/lib/model';

const someModel = createModel(
  {
    /* ... */
  },
  {
    events: {
      /* ... */
    }
  }
);

type SomeContext = ContextFrom<typeof someModel>;
type SomeEvent = EventFrom<typeof someModel>;
```
