## Using TypeScript

As XState is written in [TypeScript](https://www.typescriptlang.org/), strongly typing your statecharts is useful and encouraged. Consider this light machine example:

```typescript
// The events that the machine handles
type LightEvent =
  | { type: 'TIMER' }
  | { type: 'POWER_OUTAGE' }
  | { type: 'PED_COUNTDOWN'; duration: number };

// The context (extended state) of the machine
interface LightContext {
  elapsed: number;
}

const lightMachine = createMachine<LightContext, LightEvent>({
  key: 'light',
  initial: 'green',
  context: { elapsed: 0 },
  states: {
    green: {
      on: {
        TIMER: { target: 'yellow' },
        POWER_OUTAGE: { target: 'red' }
      }
    },
    yellow: {
      on: {
        TIMER: { target: 'red' },
        POWER_OUTAGE: { target: 'red' }
      }
    },
    red: {
      on: {
        TIMER: { target: 'green' },
        POWER_OUTAGE: { target: 'red' }
      },
      initial: 'walk',
      states: {
        walk: {
          on: {
            PED_COUNTDOWN: { target: 'wait' }
          }
        },
        wait: {
          on: {
            PED_COUNTDOWN: {
              target: 'stop',
              cond: (context, event) => {
                return event.duration === 0 && context.elapsed > 0;
              }
            }
          }
        },
        stop: {
          // Transient transition
          always: {
            target: '#light.green'
          }
        }
      }
    }
  }
});
```

Providing the context and events as generic parameters for the `createMachine()` function gives many advantages:

- The context type/interface (`TContext`) is passed on to actions, guards, services and more. It is also passed to deeply nested states.
- The event type (`TEvent`) ensures that only specified events (and built-in XState-specific ones) are used in transition configs. The provided event object shapes are also passed on to actions, guards, and services.
- Events which you send to the machine will be strongly typed, offering you much more confidence in the payload shapes you'll be receiving.

## Config Objects

The generic types for `MachineConfig<TContext, any, TEvent>` are the same as those for `createMachine<TContext, TEvent>`. This is useful when you are defining a machine config object _outside_ of the `createMachine(...)` function, and helps prevent [inference errors](https://github.com/statelyai/xstate/issues/310):

```ts
import { MachineConfig } from 'xstate';

const myMachineConfig: MachineConfig<TContext, any, TEvent> = {
  id: 'controller',
  initial: 'stopped',
  states: {
    stopped: {
      /* ... */
    },
    started: {
      /* ... */
    }
  }
  // ...
};
```

## Typestates <Badge text="4.7+" />

Typestates are a concept that narrow down the shape of the overall state `context` based on the state `value`. This can be helpful in preventing impossible states and narrowing down what the `context` should be in a given state, without having to write excessive assertions.

A `Typestate` is an interface consisting of two properties:

- `value` - the state value of the typestate (compound states should be referenced using object syntax; e.g., `{ idle: 'error' }` instead of `"idle.error"`)
- `context` - the narrowed context of the typestate when the state matches the given `value`

The typestates of a machine are specified as the 3rd generic type in `createMachine<TContext, TEvent, TTypestate>`.

**Example:**

```ts
import { createMachine, interpret } from 'xstate';

interface User {
  name: string;
}

interface UserContext {
  user?: User;
  error?: string;
}

type UserEvent =
  | { type: 'FETCH'; id: string }
  | { type: 'RESOLVE'; user: User }
  | { type: 'REJECT'; error: string };

type UserTypestate =
  | {
      value: 'idle';
      context: UserContext & {
        user: undefined;
        error: undefined;
      };
    }
  | {
      value: 'loading';
      context: UserContext;
    }
  | {
      value: 'success';
      context: UserContext & { user: User; error: undefined };
    }
  | {
      value: 'failure';
      context: UserContext & { user: undefined; error: string };
    };

const userMachine = createMachine<UserContext, UserEvent, UserTypestate>({
  id: 'user',
  initial: 'idle',
  states: {
    idle: {
      /* ... */
    },
    loading: {
      /* ... */
    },
    success: {
      /* ... */
    },
    failure: {
      /* ... */
    }
  }
});

const userService = interpret(userMachine);

userService.subscribe((state) => {
  if (state.matches('success')) {
    // from the UserState typestate, `user` will be defined
    state.context.user.name;
  }
});
```

::: warning
Compound states should have all parent state values explicitly modelled to avoid type errors when testing substates.

```typescript
type State =
  /* ... */
  | {
      value: 'parent';
      context: Context;
    }
  | {
      value: { parent: 'child' };
      context: Context;
    };
/* ... */
```

Where two states have identical context types, their declarations can be merged by using a type union for the value.

```typescript
type State =
  /* ... */
  {
    value: 'parent' | { parent: 'child' };
    context: Context;
  };
/* ... */
```

:::

## Troubleshooting

There are some known limitations with XState and TypeScript. We love TypeScript, and we're _constantly_ pressing ahead to make it a better experience in XState.

Here are some known issues, all of which can be worked around:

### Events in machine options

When you use `createMachine`, you can pass in implementations to named actions/services/guards in your config. For instance:

```ts
interface Context {}

type Event =
  | { type: 'EVENT_WITH_FLAG'; flag: boolean }
  | {
      type: 'EVENT_WITHOUT_FLAG';
    };

createMachine<Context, Event>(
  {
    on: {
      EVENT_WITH_FLAG: {
        actions: 'consoleLogData'
      }
    }
  },
  {
    actions: {
      consoleLogData: (context, event) => {
        // This will error at .flag
        console.log(event.flag);
      }
    }
  }
);
```

The reason this errors is because inside the `consoleLogData` function, we don't know which event caused it to fire. The cleanest way to manage this is to assert the event type yourself.

```ts
createMachine<Context, Event>(machine, {
  actions: {
    consoleLogData: (context, event) => {
      if (event.type !== 'EVENT_WITH_FLAG') return
      // No more error at .flag!
      console.log(event.flag);
    };
  }
})
```

It's also sometimes possible to move the implementation inline.

```ts
createMachine<Context, Event>({
  on: {
    EVENT_WITH_FLAG: {
      actions: (context, event) => {
        // No more error, because we know which event
        // is responsible for calling this action
        console.log(event.flag);
      }
    }
  }
});
```

This approach doesn't work for all cases. The action loses its name, so it becomes less nice to look at in the visualiser. It also means if the action is duplicated in several places you'll need to copy-paste it to all the places it's needed.

### Event types in entry actions

Event types in inline entry actions are not currently typed to the event that led to them. Consider this example:

```ts
interface Context {}

type Event =
  | { type: 'EVENT_WITH_FLAG'; flag: boolean }
  | {
      type: 'EVENT_WITHOUT_FLAG';
    };

createMachine<Context, Event>({
  initial: 'state1',
  states: {
    state1: {
      on: {
        EVENT_WITH_FLAG: {
          target: 'state2'
        }
      }
    },
    state2: {
      entry: [
        (context, event) => {
          // This will error at .flag
          console.log(event.flag);
        }
      ]
    }
  }
});
```

Here, we don't know what event led to the `entry` action on `state2`. The only way to fix this is to do a similar trick to above:

```ts
entry: [
  (context, event) => {
    if (event.type !== 'EVENT_WITH_FLAG') return;
    // No more error at .flag!
    console.log(event.flag);
  }
];
```

### `onDone`/`onError` events in machine options

The result of promise-based services is quite hard to type safely in XState. For instance, a machine like this:

```ts
interface Data {
  flag: boolean;
}

interface Context {}

type Event = {
  // Added here in order to bring out the TS errors
  type: 'UNUSED_EVENT';
};

createMachine<Context, Event>(
  {
    invoke: {
      src: async () => {
        const data: Data = {
          flag: true
        };
        return data;
      },
      onDone: {
        actions: 'consoleLogData'
      },
      onError: {
        actions: 'consoleLogError'
      }
    }
  },
  {
    actions: {
      consoleLogData: (context, event) => {
        // Error on this line - data does not exist!
        console.log(event.data.flag);
      },
      consoleLogError: (context, event) => {
        // Error on this line - data does not exist!
        console.log(event.data);
      }
    }
  }
);
```

Frustratingly, the best way to fix this is to cast the `event` to `any` and reassign it based on what we know it to be:

```ts
import { DoneInvokeEvent, ErrorPlatformEvent } from 'xstate'

actions: {
  consoleLogData: (context, _event: any) => {
    const event: DoneInvokeEvent<Data> = _event;
    console.log(event.data.flag);
  },
  consoleLogError: (context, _event: any) => {
    const event: ErrorPlatformEvent = _event;
    // Event.data is usually of type `Error`
    console.log(event.data.message);
  }
}
```

### Assign action behaving strangely

When run in `strict: true` mode, assign actions can sometimes behave very strangely.

```ts
interface Context {
  something: boolean;
}

createMachine<Context>({
  context: {
    something: true
  },
  entry: [
    // Type 'AssignAction<{ something: false; }, AnyEventObject>' is not assignable to type 'string'.
    assign(() => {
      return {
        something: false
      };
    }),
    // Type 'AssignAction<{ something: false; }, AnyEventObject>' is not assignable to type 'string'.
    assign({
      something: false
    }),
    // Type 'AssignAction<{ something: false; }, AnyEventObject>' is not assignable to type 'string'.
    assign({
      something: () => false
    })
  ]
});
```

It might appear that nothing you try works - all syntaxes are buggy. The fix is very strange, but works consistently. Add an unused `context` argument to the first argument of your assigner function.

```ts
entry: [
  // No more error!
  assign((context) => {
    return {
      something: false,
    };
  }),
  // No more error!
  assign({
    something: (context) => false,
  }),
  // Unfortunately this technique doesn't work for this syntax
  // assign({
  //   something: false
  // }),
],
```

This is a nasty bug to fix and involves moving our codebase to strict mode, but we're planning to do it in V5.

### `keyofStringsOnly`

If you are seeing this error:

```

Type error: Type 'string | number' does not satisfy the constraint 'string'.
Type 'number' is not assignable to type 'string'. TS2344

```

Ensure that your tsconfig file does not include `"keyofStringsOnly": true,`.
