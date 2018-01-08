# Actions

Actions in `xstate` represent the side-effects that transitioning from/to a state can produce. These actions are never executed in `xstate`; rather, they are provided to you in the `state.actions` property of the `State` instance, returned from `machine.transition(...)`.

See the [executing actions](#TODO) guide for more information.

An `Action` can be a:
  - `string`, e.g., `'fetchData'`
  - `ActionObject`, which is an `object` with:
    - an `action.type` property whose `string` value identifies the action
    - any other arbitrary properties relevant to the `action`.

# `StateNode` Action Properties

## `stateNode.onEntry`

(`Action | Action[]`) The action(s) to be executed upon entering the state.

**Usage:** A state's `onEntry` actions will be executed in the following scenarios:
- When the state is a leaf state (i.e., no child states) and is entered from a different state
- When the state is a parent state and the previous state comes from a different same-level parent
- When the state explicitly transitions to itself
- When the state is an initial state or parent of an initial state, from `machine.initialState`.

## `stateNode.onExit`

(`Action | Action[]`) The action(s) to be executed upon entering the state.

**Usage:** A state's `onExit` actions will be executed in the following scenarios:
- When the state is a leaf state and is exited to go to a different state
- When the state is a parent state and the next state goes to a different same-level parent
- When the state explicitly transitions to itself

All `onExit` actions will always occur first, before any `onEntry` or transition actions.

## `transition.actions`

(`Action[]`) The action(s) to be executed on the determined transition.

**Usage:** These actions will always occur before `onEntry` actions and after `onExit` actions.

```js
const fetchMachine = Machine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        FETCH: {
          pending: {
            // transition actions
            actions: ['warmCache']
          }
        }
      },
      // onExit actions
      onExit: ['preloadViews']
    },
    pending: {
      // onEntry actions
      onEntry: ['fetchData']
    }
  }
});

console.log(fetchMachine.transition(fetchMachine.initialState, 'FETCH'));
// => State {
//   value: 'pending',
//   history: new State('idle'),
//   actions: [
//     'preloadViews', // onExit action for 'idle' state
//     'warmCache', // transition action for 'idle' -> 'pending' on 'FETCH'
//     'fetchData' // onEntry action for 'pending' state
//   ]
// }
```
