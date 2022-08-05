## Using TypeScript

As XState is written in [TypeScript](https://www.typescriptlang.org/), strongly typing your statecharts is useful and encouraged.

```typescript
import { createMachine } from 'xstate';

const lightMachine = createMachine({
  schema: {
    // The context (extended state) of the machine
    context: {} as { elapsed: number },
    // The events this machine handles
    events: {} as
      | { type: 'TIMER' }
      | { type: 'POWER_OUTAGE' }
      | { type: 'PED_COUNTDOWN'; duration: number }
  }
  /* Other config... */
});
```

Providing the context and events to the `schema` attribute gives many advantages:

- The context type/interface (`TContext`) is passed on to actions, guards, services and more. It is also passed to deeply nested states.
- The event type (`TEvent`) ensures that only specified events (and built-in XState-specific ones) are used in transition configs. The provided event object shapes are also passed on to actions, guards, and services.
- Events which you send to the machine will be strongly typed, offering you much more confidence in the payload shapes you'll be receiving.

## Typegen <Badge text="4.29+" />

::: warning Experimental Feature

This feature is in beta! See the section on known limitations below to see what we're actively looking to improve.

:::

Using our [VS Code extension](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode) or our [CLI](../packages/xstate-cli/index.md), you can automatically generate intelligent typings for XState.

Here's how you can get started:

1. Download and install the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode) OR install the [CLI](../packages/xstate-cli/index.md) and run the `xstate typegen` command with the `--watch` flag.
2. Open a new file and create a new machine, passing the schema attributes:

```ts
import { createMachine } from 'xstate';

const machine = createMachine({
  schema: {
    context: {} as { value: string },
    events: {} as { type: 'FOO'; value: string } | { type: 'BAR' }
  },
  initial: 'a',
  context: {
    value: '',
  },
  states: {
    a: {
      on: {
        FOO: {
          actions: 'consoleLogValue',
          target: 'b'
        }
      }
    },
    b: {
      entry: 'consoleLogValueAgain'
    }
  }
});
```

3. Add `tsTypes: {}` to the machine and save the file:

```ts
const machine = createMachine({
  tsTypes: {},
  schema: {
    context: {} as { value: string },
    events: {} as { type: 'FOO'; value: string } | { type: 'BAR' }
  },
  context: {
    value: '',
  },
  initial: 'a',
  states: {
    /* ... */
  }
});
```

4. The extension should automatically add a generic to the machine:

```ts
const machine = createMachine({
  tsTypes: {} as import('./filename.typegen').Typegen0
  /* ... */
});
```

5. Add a second parameter into the `createMachine` call - this is where you implement the actions, services, guards and delays for the machine.

```ts
const machine = createMachine(
  {
    /* ... */
  },
  {
    actions: {
      consoleLogValue: (context, event) => {
        // Wow! event is typed to { type: 'FOO' }
        console.log(event.value);
      },
      consoleLogValueAgain: (context, event) => {
        // Wow! event is typed to { type: 'FOO' }
        console.log(event.value);
      }
    }
  }
);
```

You'll notice that the events in the options are _strongly typed to the events that cause the action to be triggered_. This is true for actions, guards, services and delays.

You'll also notice that `state.matches`, `tags` and other parts of the machine are now type-safe.

### Typing promise services

You can use the generated types to specify the return type of promise-based services, by using the `services` schema property:

```ts
import { createMachine } from 'xstate';

createMachine(
  {
    schema: {
      services: {} as {
        myService: {
          // The data that gets returned from the service
          data: { id: string };
        };
      }
    },
    invoke: {
      src: 'myService',
      onDone: {
        actions: 'consoleLogId'
      }
    }
  },
  {
    services: {
      myService: async () => {
        // This return type is now type-safe
        return {
          id: '1'
        };
      }
    },
    actions: {
      consoleLogId: (context, event) => {
        // This event type is now type-safe
        console.log(event.data.id);
      }
    }
  }
);
```

### How to get the most out of the VS Code extension

#### Use named actions/guards/services

Our recommendation with this approach is to mostly use named actions/guards/services, not inline ones.

This is optimal:

```ts
createMachine(
  {
    entry: ['sayHello']
  },
  {
    actions: {
      sayHello: () => {
        console.log('Hello!');
      }
    }
  }
);
```

This is useful, but less optimal:

```ts
createMachine({
  entry: [
    () => {
      console.log('Hello!');
    }
  ]
});
```

Named actions/services/guards allow for:

- Better visualisation, because the names appear in the statechart
- Easier-to-understand code
- Overrides in `useMachine`, or `machine.withConfig`

#### The generated files

We recommend you gitignore the generated files (`*filename*.typegen.ts`) from the repository.

You can use the [CLI](../packages/xstate-cli/index.md) to regenerate them on CI, for instance via a postinstall script:

```json
{
  "scripts": {
    "postinstall": "xstate typegen \"./src/**/*.ts?(x)\""
  }
}
```

#### Don't use enums

Enums were a common pattern used with XState TypeScript. They were often used to declare state names. like this:

```ts
enum States {
  A,
  B
}

createMachine({
  initial: States.A,
  states: {
    [States.A]: {},
    [States.B]: {}
  }
});
```

You can then check `state.matches(States.A)` on the resulting machine. This allows for type-safe checks of state names.

With typegen, using enums is no longer necessary - all `state.matches` types are type-safe. Enums are currently not supported by our static analysis tool. It's also unlikely that we'll ever support them with typegen due to the complexity they add for comparatively little gain.

Instead of enums, use typegen and rely on the strength of the type-safety it provides.

### Known limitations

#### Always transitions/raised events

Actions/services/guards/delays might currently get incorrectly annotated if they are called "in response" to always transitions or raised events. We are working on fixing this, both in XState and in the typegen.

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
import { createMachine } from 'xstate';

interface Context {}

type Event =
  | { type: 'EVENT_WITH_FLAG'; flag: boolean }
  | {
      type: 'EVENT_WITHOUT_FLAG';
    };

createMachine(
  {
    schema: {
      context: {} as Context,
      events: {} as Event
    },
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
createMachine(config, {
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
import { createMachine } from 'xstate';

createMachine({
  schema: {
    context: {} as Context,
    events: {} as Event
  },
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
import { createMachine } from 'xstate';

interface Context {}

type Event =
  | { type: 'EVENT_WITH_FLAG'; flag: boolean }
  | {
      type: 'EVENT_WITHOUT_FLAG';
    };

createMachine({
  schema: {
    context: {} as Context,
    events: {} as Event
  },
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

### Assign action behaving strangely

When run in `strict: true` mode, assign actions can sometimes behave very strangely.

```ts
interface Context {
  something: boolean;
}

createMachine({
  schema: {
    context: {} as Context
  },
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
