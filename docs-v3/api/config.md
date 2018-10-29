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
- `id`: (string) The unique identifier of the state node (since 3.3).
  - Optional, defaults to the delimited full path to the state node, e.g., `'foo.bar.baz'`
- `on`: (object) The mapping of event types to [transitions](#transition-configuration).
  - Optional, especially if state is a final state.
- `onEntry`: (string | string[]) The name(s) of actions to be executed upon entry to this state.
  - Optional.
- `onExit`: (string | string[]) The name(s) of actions to be executed upon exit from this state.
  - Optional.
- `data`: (any) Any meta data related to the state node (since 3.2).
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

Compound states (states with substates) can also have a `state` property, just like machines. You must include either `initial` or `parallel` for these compound states - they have the same configuration as standard/parallel machines.

## Transition Configuration

On the [state configuration](#state-configuration), transitions are specified in the `on` property. The values can be
- an object mapping events to `string` state IDs:

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

- an object mapping events to transition configs with these props:
  - `cond`: (string | function) a conditional guard that must evaluate to `true` for the transition to take place (see [guarded transitions](guides/guards.md))
    - Optional.
  - `actions`: (Action[]) an array of action strings or objects that are to be executed when the transition takes place (see [actions](api/actions.md))
    - Optional.
  <!-- - `in`: (string | object) a string or object representing the state that the current state must match for the transition to take place (see [guarded transitions](guides/guards.md))
    - Optional. -->
  - `internal`: (boolean) whether the transition is an internal transition or not (see [internal transitions](guides/internal.md))
    - Optional, defaults to `false`

```js
const lightMachine = Machine({
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: {
          target: 'yellow', // since 4.0
          // specify that 'startYellowTimer' action should be executed
          actions: ['startYellowTimer']
        }
      }
    },
    yellow: {
      on: {
        TIMER: {
          target: 'red', // since 4.0
          // transition to 'red' only if < 100 seconds elapsed
          cond: ({ elapsed }) => elapsed < 100
        }
      }
    },
    red: {
      // ...
    }
  }
});
```

- an array of conditional transitions with the same configuration as above, but with an additional `target` prop:
  - `target`: (string | string[]) a string or array of strings representing the state(s) that the machine will transition to.

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
