# History States

A history state is a special kind of state that, when reached, tells the machine to go to the last state value of that region. There's two types of history states:
- `'shallow'`, which specifies only the top-level history value, or
- `'deep'`, which specifies the top-level and all child-level history values.

## History State Configuration

The configuration for a history state is the same as a simple (leaf) state node, with two extra properties:
- `history`: ('shallow' | 'deep' | true) whether the history is shallow or deep
  - If `true`, defaults to 'shallow'.
- `target`: (StateValue) the default target if no history exists
  - Optional, defaults to the initial state value.

Consider the following (contrived) statechart:

```js
const historyMachine = Machine({
  initial: 'off',
  states: {
    fanOff: {
      on: {
        // transitions to history state
        POWER: 'fanOn.hist',
        HIGH_POWER: 'fanOn.highPowerHist'
      }
    },
    fanOn: {
      initial: 'first',
      states: {
        first: {
          on: { SWITCH: 'second' }
        },
        second: {
          on: { SWITCH: 'third' }
        },
        third: {},

        // shallow history state
        hist: {
          history: true
        },

        // shallow history state with default
        highPowerHist: {
          history: true,
          target: 'third'
        }
      },
      on: {
        POWER: 'fanOff'
      }
    }
  }
});
```

In the above machine, the transition from `'off'` on the event `'POWER'` goes to the `'on.hist'` state, which is defined as a shallow history state. This means that the machine should transition to the `'on'` state and to whichever the previous substate of `'on'` was. By default, `'on'` will go to its initial state, `'first'`, if there is no history state.

```js
const firstState = historyMachine.transition(historyMachine.initialState, 'POWER');
console.log(firstState.value);
// transitions to the initial state of 'fanOn' since there is no history
// => {
//   fanOn: 'first'
// }

const secondState = historyMachine.transition(firstState, 'SWITCH');
console.log(secondState.value);
// => {
//   fanOn: 'second'
// }

const thirdState = historyMachine.transition(secondState, 'POWER');
console.log(thirdState.value);
// => 'off'

console.log(thirdState.history);
// => State {
//   value: { fanOn: 'second' },
//   actions: []
// }

const fourthState = historyMachine.transition(thirdState, 'POWER');
console.log(fourthState.value);
// transitions to 'fanOn.second' from history
// => {
//   fanOn: 'second'
// }
```

With a `target` specified, if no history exists for the state region the history state is defined in, it will go to the `target` state by default:

```js
const firstState = historyMachine.transition(historyMachine.initialState, 'HIGH_POWER');
console.log(firstState.value);
// transitions to the target state of 'fanOn.third' since there is no history
// => {
//   fanOn: 'third'
// }
```

**Notes:**
- Explicit history states, as described above, are available since 3.3.
- Prior versions use the special `$history` subpath, which is equivalent to an implicit shallow history state. This will be deprecated in 4.0.
- History states can be directly accessed from `State` instances on `state.history`, but this is seldom necessary.
