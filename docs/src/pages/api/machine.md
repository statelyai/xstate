# Machine

A machine in XState represents a hierarchical state machine, or statechart. The `Machine(...)` function creates these machines.

## `Machine(config)`

**Arguments:**

- `config`: `MachineConfig | ParallelMachineConfig`

**Returns:** `StandardMachine | ParallelMachine`

**Usage:** There's two types of machines that can be returned. A `StandardMachine` has an `initial` state set:

```js
const standardMachine = Machine({
  initial: 'green',
  states: {
    green: { on: { TIMER: 'yellow' } },
    yellow: { on: { TIMER: 'red' } },
    red: { on: { TIMER: 'green' } }
  }
});

standardMachine.initialState.value;
// => 'green'
```

Whereas a `ParallelMachine` has no initial state (since all of its child states are entered simultaneously) and has `parallel: true` set in its config:

```js
const parallelMachine = Machine({
  parallel: true,
  states: {
    upload: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            INIT_UPLOAD: 'pending'
          }
        },
        pending: {
          on: {
            UPLOAD_COMPLETE: 'success'
          }
        },
        success: {}
      }
    },
    download: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            INIT_DOWNLOAD: 'pending'
          }
        },
        pending: {
          on: {
            DOWNLOAD_COMPLETE: 'success'
          }
        },
        success: {}
      }
    }
  }
});

console.log(parallelMachine.initialState.value);
// => {
//   upload: 'idle',
//   download: 'idle'
// }
```

# Machine properties and methods

## `machine.transition(state, event, extendedState?)`

Returns the next `State` given the current `state` and the received `event`.

If [guard conditions](guides/guards#conditional-transitions-guards) are used, the `extendedState` is used to determine the correct transition to the next state.

**Arguments:**

- `state`: `StateValue | State`
  - e.g., `'green'` or `'red.walk'` or `{ red: 'walk' }`
  - can also be an instance of a `State` returned from a previous `machine.transition(...)` call.
- `event`: `Event`
  - e.g., `'TIMER'` or `{ type: 'TIMER', elapsed: 2000 }`
- `extendedState?`: `any`

**Returns:** `State`

**Usage:** This is the method you will use most frequently with XState. Its main purpose is to answer the question, "What is the next state, given the current state and event?"

```js
// simple usage, with a string state key and event
const yellowState = standardMachine.transition('green', 'TIMER');
console.log(yellowState);
// => State {
//   value: 'yellow',
//   history: State('green', undefined, []),
//   actions: []
// }
console.log(yellowState.value);
// => 'yellow'

// with an object as an event
const timerEvent = {
  type: 'TIMER',
  elapsed: 2000
};
const redState = standardMachine.transition('yellow', timerEvent);
console.log(redState.value);
// => 'red'

// with a State instance
const greenState = standardMachine.transition(redState, 'TIMER');
console.log(greenState.value);
// => 'green'

// with an object state value (useful for parallel machines)
const downloadingState = parallelMachine.transition(
  {
    upload: 'idle',
    download: 'idle'
  },
  'INIT_DOWNLOAD'
);
console.log(downloadingState.value);
// => {
//   upload: 'idle',
//   download: 'pending'
// }
```

## `machine.initialState`

(`State`) The initial `State` of the machine.

**Usage:**

```js
const standardInitialState = standardMachine.initialState;
console.log(standardInitialState.value);
// => 'green'

const parallelInitialState = parallelMachine.initialState;
console.log(parallelInitialState.value);
// => {
//   upload: 'idle',
//   download: 'idle'
// }
```

## `machine.events`

(`string[]`) All events handled by the machine.

**Usage:**

```js
console.log(parallelMachine.events);
// => ['INIT_UPLOAD', 'UPLOAD_COMPLETE', 'INIT_DOWNLOAD', 'DOWNLOAD_COMPLETE']
```

## `machine.getState(relativeStateId)`

Returns the `StateNode` specified by the string `relativeStateId`, if it exists.

**Arguments:**

- `relativeStateId`: `string`
  - e.g., `'green'` or `'download.pending'`

**Returns:** `StateNode`

**Usage:**

```js
const greenStateNode = standardMachine.getState('green');
console.log(greenStateNode.id);
// => 'green'
```

## `machine.handles`

(`boolean`) Determines if the machine handles a given event.

**Arguments:**

- `event`: `Event`
- e.g., 'TIMER' or { type: 'TIMER', elapsed: 2000 }

**Usage:**

```js
console.log(standardMachine.handles('TIMER'));
// => true
console.log(standardMachine.handles('INIT_UPLOAD'));
// => false
```
