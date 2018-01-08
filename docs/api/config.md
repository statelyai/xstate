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
