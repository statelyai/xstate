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
