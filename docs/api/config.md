# Machine and State Configuration

In xstate, statecharts are recursive data structures, where the machine and its states (and deeper states) share a common configuration schema.

## Machine Configuration

- `initial`: (string) The relative state key of the initial state.
  - Optional for simple states with no substates (i.e., when `states` is undefined).
  - Must be `undefined` if `parallel: true` is set.
- `parallel`: (boolean) Set to `true` if this is a parallel machine.
  - Optional (default: `false`).
- `states`: (object) The mapping of state keys to their state configuration.
- `key`: (string) The name of the machine.
  - Optional, but recommended for debugging purposes.
- `strict`: (boolean) Set to `true` if you want strict errors to show (e.g., transitioning from events that are not accepted by the machine)
  - Optional (default: `false`)

```js
// standard machine config
const standardMachineConfig = {
  key: 'light',
  initial: 'green',
  states: {
    green: { on: { TIMER: 'yellow' } },
    yellow: { on: { TIMER: 'red' } },
    red: { on: { TIMER: 'green' } },
  }
};

// parallel machine config
const parallelMachineConfig = {
  key: 'intersection',
  parallel: true,
  states: {
    northSouthLight: {
      initial: 'green',
      states: {
        green: { on: { TIMER: 'yellow' } },
        yellow: { on: { TIMER: 'red' } },
        red: { on: { TIMER: 'green' } },
      }
    },
    eastWestLight: {
      initial: 'red',
      states: {
        green: { on: { TIMER: 'yellow' } },
        yellow: { on: { TIMER: 'red' } },
        red: { on: { TIMER: 'green' } },
      }
    }
  }
}
```

## State Configuration

- `on`: (object) The mapping of event types to [transitions](#transition-configuration).
  - Optional, especially if state is a final state.
- `onEntry`: (string | string[]) The name(s) of actions to be executed upon entry to this state.
  - Optional.
- `onExit`: (string | string[]) The name(s) of actions to be executed upon exit from this state.
  - Optional.

```js
const redStateConfig = {
  initial: 'walk',
  states: {
    walk: {
      onEntry: ['flashWalkSign'],
      on: {
        PED_COUNTDOWN: 'wait'
      }
    },
    wait: {
      onEntry: ['flashWaitSign', 'startCountdown'],
      on: {
        PED_COUNTDOWN: 'stop'
      }
    },
    stop: {}
  },
  on: {
    TIMER: 'green',
    POWER_OUTAGE: 'red'
  }
}
```

## Transition Configuration

On the [state configuration](#state-configuration), transitions are specified in the `on` property, which is a mapping of `string` event types to:
- `string` state IDs, or
- a state transition mapping, or
- an array of state transition mappings

The `on` property answers the question, "On this event, which state do I go to next?" The simplest representation is a `string` state ID:

```js
const lightMachine = Machine({
  initial: 'green',
  states: {
    green: {
      on: {
        // on the 'TIMER' event, go to the 'yellow' state
        TIMER: 'yellow'
      }
    },
    yellow: {
      // ...
    },
    red: {
      // ...
    }
  }
});
```

For [guarded transitions](guides/guards.md) and actions, instead of a `string` state ID, you can use either a single state transition mapping, or an array of mappings.

The single state transition mapping looks like:

```js
const lightMachine = Machine({
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: {
          yellow: {
            // specify that 'startYellowTimer' action should be executed
            actions: ['startYellowTimer']
          }
        }
      }
    },
    yellow: {
      on: {
        TIMER: {
          // transition to 'red' only if < 100 seconds elapsed
          red: { cond: ({ elapsed }) => elapsed < 100 }
        }
      }
    },
    red: {
      // ...
    }
  }
});
```

When you want transition to different states from a single event based on external state you can provide an array of mappings with `cond` functions:

```js
const lightMachine = Machine({
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: [
          // transition to 'green' only if < 100 seconds elapsed
          { target: 'green', cond: ({ elapsed }) => elapsed < 100 },
          // transition to 'yellow' only if >= 200 seconds elapsed
          { target: 'yellow', cond: ({ elapsed }) => elapsed >= 200},
          // otherwise transition to 'red'
          { target: 'red' }
        ]
      }
    },
    yellow: {
      // ...
    },
    red: {
      // ...
    }
  }
});
```

Note: both `cond` and `actions` are optional, and they can both be specified together as well.
