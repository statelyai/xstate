## Using TypeScript

As XState is written in [TypeScript](https://www.typescriptlang.org/), strongly typing your statecharts is useful and encouraged. Consider this light machine example:

```typescript
// The hierarchical (recursive) schema for the states
interface LightStateSchema {
  states: {
    green: {};
    yellow: {};
    red: {
      states: {
        walk: {};
        wait: {};
        stop: {};
      };
    };
  };
}

// The events that the machine handles
type LightEvent =
  | { type: 'TIMER' }
  | { type: 'POWER_OUTAGE' }
  | { type: 'PED_COUNTDOWN'; duration: number };

// The context (extended state) of the machine
interface LightContext {
  elapsed: number;
}

const lightMachine = Machine<LightContext, LightStateSchema, LightEvent>({
  key: 'light',
  initial: 'green',
  context: { elapsed: 0 },
  states: {
    green: {
      on: {
        TIMER: 'yellow',
        POWER_OUTAGE: 'red'
      }
    },
    yellow: {
      on: {
        TIMER: 'red',
        POWER_OUTAGE: 'red'
      }
    },
    red: {
      on: {
        TIMER: 'green',
        POWER_OUTAGE: 'red'
      },
      initial: 'walk',
      states: {
        walk: {
          on: {
            PED_COUNTDOWN: 'wait'
          }
        },
        wait: {
          on: {
            PED_COUNTDOWN: {
              target: 'stop',
              cond: (ctx, e) => {
                return e.duration === 0 && ctx.elapsed > 0;
              }
            }
          }
        },
        stop: {
          on: {
            // Transient transition
            '': { target: 'green' }
          }
        }
      }
    }
  }
});
```

Providing the context, state schema, and events as generic parameters for the `Machine()` function may seem tedious (and is completely optional), but gives many advantages:

- The context type/interface (`TContext`) is passed on to action `exec` functions, guard `cond` functions, and more. It is also passed to deeply nested states.
- The state schema type/interface (`TStateSchema`) ensures that only state keys defined on the schema are allowed in the actual config object. Nested state schemas are recursively passed down to their representative child states.
- The event type (`TEvent`) ensures that only specified events (and built-in XState-specific ones) are used in transition configs. The provided event object shapes are also passed on to action `exec` functions, guard `cond` functions, and more. This can prevent unnecessary `event.somePayload === undefined` checks.

Note if you are seeing this error:

```
Type error: Type 'string | number' does not satisfy the constraint 'string'.
  Type 'number' is not assignable to type 'string'.  TS2344
```

Ensure that your tsconfig file can does not include `"keyofStringsOnly": true,`.

## Config Objects

The generic types for `MachineConfig<TContext, TSchema, TEvent>` are the same as those for `Machine<TContext, TSchema, TEvent>`. This is useful when you are defining a machine config object _outside_ of the `Machine(...)` function, and helps prevent [inference errors](https://github.com/davidkpiano/xstate/issues/310):

```ts
import { MachineConfig } from 'xstate';

const myMachineConfig: MachineConfig<TContext, TSchema, TEvent> = {
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
