# @xstate/fsm

This package contains a minimal implementation of XState for finite state machines.

**Features:**

- Finite states (non-nested)
- Initial state
- Transitions (object or strings)
- Context
- Entry actions
- Exit actions
- Transition actions
- `state.changed`

If you want to use statechart features such as nested states, parallel states, history states, activities, invoked services, delayed transitions, transient transitions, etc. please use [`XState`](https://github.com/davidkpiano/xstate).

## Super quick start

```bash
npm i @xstate/fsm
```

```js
import { FSM } from '@xstate/fsm';

// Stateless FSM definition
// machine.transition(...) is a pure function.
const toggleFSM = FSM({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: { on: { TOGGLE: 'inactive' } }
  }
});

const { initialState } = toggleFSM;

const toggledState = toggleFSM.transition(initialState, 'TOGGLE');
toggledState.value;
// => 'active'

const untoggledState = toggleFSM.transition(toggledState, 'TOGGLE');
untoggledState.value;
// => 'inactive'
```

## API

### `FSM(config)`

Creates a new finite state machine (FSM) from the config, which has this schema:

### Machine config

- `id` (string) - an identifier for the type of machine this is. Useful for debugging.
- `initial` (string) - the key of the initial state.
- `states` (object) - an object mapping state names (keys) to [states](#state-config)

### State config

- `on` (object) - an object mapping event types (keys) to [transitions](#transition-config)

### Transition config

String syntax:

- (string) - the state name to transition to.
  - Same as `{ target: stateName }`

Object syntax:

- `target?` (string) - the state name to transition to.
- `actions?` (Action | Action[]) - the [action(s)](#action-config) to execute when this transition is taken.
- `cond?` (Guard) - the condition (predicate function) to test. If it returns `true`, the transition will be taken.

### Action config

String syntax:

- (string) - the action type.
  - Resolves to `{ type: actionType, exec: undefined }`

Function syntax:

- (function) - the action function to execute. Resolves to `{ type: actionFn.name, exec: actionFn }` and the function takes the following arguments:
  1. `context` (any) - the machine's current `context`.
  2. `event` (object) - the event that caused the action to be executed.

Object syntax:

- `type` (string) - the action type.
- `exec?` (function) - the action function to execute.

## Usage

```js
import { FSM, assign } from '@xstate/fsm';

const lightFSM = FSM({
  id: 'light',
  initial: 'green',
  context: { redLights: 0 },
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: {
          target: 'red',
          actions: () => console.log('Going to red!')
        }
      }
    },
    red: {
      entry: assign({ redLights: ctx => ctx.redLights + 1 }),
      on: {
        TIMER: 'green'
      }
    }
  }
});

const { initialState } = lightFSM;
// {
//   value: 'green',
//   context: { redLights: 0 },
//   actions: [],
//   changed: undefined
// }

const yellowState = lightFSM.transition(initialState, 'TIMER');
// {
//   value: 'yellow',
//   context: { redLights: 0 },
//   actions: [
//     { type: undefined, exec: () => console.log('Going to red!') }
//   ],
//   changed: true
// }

const redState = lightFSM.transition(yellowState, 'TIMER');
// {
//   value: 'red',
//   context: { redLights: 1 },
//   actions: [],
//   changed: true
// }
```
