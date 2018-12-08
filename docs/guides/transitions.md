# Transitions

A state transition defines what the **next state** is, given the **current state** and [**event**](./events.md). State transitions are defined on state nodes, in the `on` property:

```js
import { Machine } from 'xstate';

const promiseMachine = Machine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {
      on: {
        // state transition (shorthand)
        // this is equivalent to { target: 'resolved' }
        RESOLVE: 'resolved',

        // state transition (object)
        REJECT: {
          target: 'rejected'
        }
      }
    },
    resolved: {
      type: 'final'
    },
    rejected: {
      type: 'final'
    }
  }
});

const { initialState } = promiseMachine;

console.log(initialState.value);
// => 'pending'

const nextState = promiseMachine.transition(initialState, 'RESOLVE');

console.log(nextState.value);
// => 'resolved'
```

In the above example, when the machine is in the `pending` state and it receives a `RESOLVE` event, it will transition to the `resolved` state.

A state transition can be defined as:

- a string, e.g., `RESOLVE: 'resolved'`, which is equivalent to...
- an object with a `target` property, e.g., `RESOLVE: { target: 'resolved' }`,
- an array of transition objects, which are used for conditional transitions (see [guards](./guards.md))

## Machine `.transition` Method

As seen above, the `machine.transition(...)` method is a pure function that takes two arguments:

- `state` - the [State](./states.md) to transition from
- `event` - the [event](./events.md) that causes the transition

It returns a new [`State` instance](./states.md#state-definition), which is the result of taking all the transitions enabled by the current state and event.

```js
const lightMachine = Machine({
  /* ... */
});

const greenState = lightMachine.initialState;

// determine next state based on current state and event
const yellowState = lightMachine.transition(greenState, { type: 'TIMER' });

console.log(yellowState.value);
// => 'yellow'
```

## Selecting Enabled Transitions

An **enabled transition** is a transition that will be taken, given the current state and event. It will be taken if and only if:

- it is defined on a [state node](./statenodes.md) that matches the current state value
- the transition [guard](./guards.md) (`cond` property) is satisfied (evaluates to `true`)
- it is not supeseded by a more specific transition.

In a [hierarchical machine](./hierarchical.md), transitions are prioritized by how deep they are in the tree; deeper transitions are more specific and thus have higher priority. This works similar to how DOM events work: if you click a button, the click event handler directly on the button is more specific than a click event handler on the `window`.

```js
const wizardMachine = Machine({
  id: 'wizard',
  initial: 'open',
  states: {
    open: {
      initial: 'step1',
      states: {
        step1: {
          on: { NEXT: 'step2' }
        },
        step2: {
          /* ... */
        },
        step3: {
          /* ... */
        }
      },
      on: {
        NEXT: 'goodbye',
        CLOSE: 'closed'
      }
    },
    goodbye: {
      on: { CLOSE: 'closed' }
    },
    closed: { type: 'final' }
  }
});

// { open: 'step1' }
const { initialState } = wizardMachine;

// the NEXT transition defined on 'open.step1'
// supersedes the NEXT transition defined
// on the parent 'open' state
const nextStepState = wizardMachine.transition(initialState, 'NEXT');
console.log(nextStepState.value);
// => { open: 'step2' }

// there is no CLOSE transition on 'open.step1'
// so the event is passed up to the parent
// 'open' state, where it is defined
const closedState = wizardMachine.transition(initialState, 'CLOSE');
console.log(closedState.value);
// => 'closed'
```
