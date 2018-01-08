# History States

Traditionally, statecharts define special "history states" in two variants: shallow and deep history states. This requires a state machine itself to be "stateful" and remember which states it was in.

In `xstate`, a slightly different but equally valid approach is taken - instead of the history being part of the `Machine`, it is part of the returned `State` in an immutable, pure way. When a transition occurs from state A to state B, state A is recorded as the `history` state inside of state B. That way, any transition from state B that requires history can refer to state B's history state (in this case, state A).

Consider the following (contrived) statechart:

```js
const historyMachine = Machine({
  initial: 'off',
  states: {
    off: {
      on: { POWER: 'on.$history' }
    },
    on: {
      initial: 'first',
      states: {
        first: {
          on: { SWITCH: 'second' }
        },
        second: {
          on: { SWITCH: 'third' }
        },
        third: {}
      },
      on: {
        POWER: 'off'
      }
    }
  }
});
```

In the above machine, the transition from `'off'` on the event `'POWER'` goes to the `'on.$history'` state. This means that the machine should transition to the `'on'` state and to whichever the previous substate of `'on'` was. By default, `'on'` will go to its initial state, `'first'`, if there is no history state.

```js
const firstState = historyMachine.transition(historyMachine.initialState, 'POWER');
console.log(firstState.value);
// transitions to the initial state of 'on' since there is no history
// => {
//   on: 'first'
// }

const secondState = historyMachine.transition(firstState, 'SWITCH');
console.log(secondState.value);
// => {
//   on: 'second'
// }

const thirdState = historyMachine.transition(secondState, 'POWER');
console.log(thirdState.value);
// => 'off'

console.log(thirdState.history);
// => State {
//   value: { on: 'second' },
//   history: secondState,
//   actions: []
// }

const fourthState = historyMachine.transition(thirdState, 'POWER');
console.log(fourthState.value);
// transitions to 'on.second' from history
// => {
//   on: 'second'
// }
```

History states can be directly accessed from `State` instances on `state.history`, but this is seldom necessary.
