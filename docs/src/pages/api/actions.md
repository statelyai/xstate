import { StateChart } from '../../components/StateChart';

# Actions

Actions in `xstate` represent the side-effects that transitioning from/to a state can produce. These actions are never executed in `xstate`; rather, they are provided to you in the `state.actions` property of the `State` instance, returned from `machine.transition(...)`.

An `Action` can be a:

- `string`, e.g., `'fetchData'`
- `ActionObject`, which is an `object` with:
  - an `action.type` property whose `string` value identifies the action
  - any other arbitrary properties relevant to the `action`.
- `function`, a named function with two arguments (since 3.3):
  - `ctx` - the context (i.e., the [extended state](/guides/context))
  - `event` - the `EventObject` associated with the action

# State Node Action Properties

## `stateNode.onEntry`

(`Action | Action[]`) The action(s) to be executed upon entering the state.

**Usage:** A state's `onEntry` actions will be executed in the following scenarios:

- When the state is a leaf state (i.e., no child states) and is entered from a different state
- When the state is a parent state and the previous state comes from a different same-level parent
- When the state explicitly transitions to itself
- When the state is an initial state or parent of an initial state, from `machine.initialState`.

## `stateNode.onExit`

(`Action | Action[]`) The action(s) to be executed upon exiting the state.

**Usage:** A state's `onExit` actions will be executed in the following scenarios:

- When the state is a leaf state and is exited to go to a different state
- When the state is a parent state and the next state goes to a different same-level parent
- When the state explicitly transitions to itself

All `onExit` actions will always occur first, before any `onEntry` or transition actions.

## `transition.actions`

(`Action[]`) The action(s) to be executed on the determined transition.

**Usage:** These actions will always occur before `onEntry` actions and after `onExit` actions.

```js
// example of a named function action
function showLoader(ctx, event) {
  // ...
}

const fetchMachine = Machine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        FETCH: {
          target: 'pending', // since 4.0
          // transition actions
          actions: ['warmCache', showLoader]
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
//     [Function: showLoader], // transition action for 'idle' -> 'pending' on 'FETCH'
//     'fetchData' // onEntry action for 'pending' state
//   ]
// }
```

**Notes:**

- Prefer `actions` defined on transitions. Avoid excessive usage of `onEntry` or `onExit` actions.
- As a rule of thumb, if you are absolutely sure that every possible transition to or from a state will exhibit the same actions, only then should you use `onEntry` or `onExit` actions, respectively.
- Prefer action objects (e.g., `{ type: 'SOME_EVENT' }`) over string events. In `4.0`, all actions in the `state.actions` array will be normalized as objects.
- Avoid unnamed function actions, such as `() => { ... }`. This makes visualization less helpful.
- Functions provided as actions will not be called by xstate, the function signature above is provided as a standard and will be used by future interpreters
