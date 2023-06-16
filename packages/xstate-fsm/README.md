# @xstate/fsm

<p align="center">
  <a href="https://xstate.js.org">
  <br />
  <img src="https://i.imgur.com/j4x2zzX.png" alt="XState FSM" width="200"/>
  <br />
    <sub><strong>XState for Finite State Machines</strong></sub>
  <br />
  <br />
  </a>
</p>

This package contains a minimal, 1kb implementation of [XState](https://github.com/statelyai/xstate) for **finite state machines**.

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-fsm/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Features

|                             | **@xstate/fsm** | [XState](https://github.com/statelyai/xstate) |
| --------------------------- | :-------------: | :-------------------------------------------: |
| Finite states               |       ✅        |                      ✅                       |
| Initial state               |       ✅        |                      ✅                       |
| Transitions (object)        |       ✅        |                      ✅                       |
| Transitions (string target) |       ✅        |                      ✅                       |
| Delayed transitions         |       ❌        |                      ✅                       |
| Eventless transitions       |       ❌        |                      ✅                       |
| Wildcard transitions        |       ✅        |                      ✅                       |
| Nested states               |       ❌        |                      ✅                       |
| Parallel states             |       ❌        |                      ✅                       |
| History states              |       ❌        |                      ✅                       |
| Final states                |       ❌        |                      ✅                       |
| Context                     |       ✅        |                      ✅                       |
| Entry actions               |       ✅        |                      ✅                       |
| Exit actions                |       ✅        |                      ✅                       |
| Transition actions          |       ✅        |                      ✅                       |
| Parameterized actions       |       ❌        |                      ✅                       |
| Transition guards           |       ✅        |                      ✅                       |
| Parameterized guards        |       ❌        |                      ✅                       |
| Spawned actors              |       ❌        |                      ✅                       |
| Invoked actors              |       ❌        |                      ✅                       |

- Finite states (non-nested)
- Initial state
- Transitions (object or strings)
- Context
- Entry actions
- Exit actions
- Transition actions
- `state.changed`

If you want to use statechart features such as nested states, parallel states, history states, activities, invoked services, delayed transitions, transient transitions, etc. please use [`XState`](https://github.com/statelyai/xstate).

## Quick start

### Installation

```bash
npm i @xstate/fsm
```

### Usage (machine)

```js
import { createMachine } from '@xstate/fsm';

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: { on: { TOGGLE: 'inactive' } }
  }
});

const { initialState } = toggleMachine;

const toggledState = toggleMachine.transition(initialState, 'TOGGLE');
toggledState.value;
const untoggledState = toggleMachine.transition(toggledState, 'TOGGLE');
untoggledState.value;
// => 'inactive'
```

### Usage (service)

```js
import { createMachine, interpret } from '@xstate/fsm';

const toggleMachine = createMachine({});

const toggleService = interpret(toggleMachine).start();

toggleService.subscribe((state) => {
  console.log(state.value);
});

toggleService.send('TOGGLE');
toggleService.send('TOGGLE');
toggleService.stop();
```
