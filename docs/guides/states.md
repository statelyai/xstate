# States

A state is an abstract representation of a system (such as an application) at a specific point in time. As an application is interacted with, events cause it to change state. A finite state machine can be in only one of a finite number of states at any given time. The current state of a machine is represented by a `State` instance:

```js
const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      /* ... */
    }
    // ...
  }
});

console.log(lightMachine.initialState);
// State {
//   value: 'green',
//   actions: [],
//   context: undefined,
//   // ...
// }

console.log(lightMachine.transition('yellow', 'TIMER'));
// State {
//   value: { red: 'walk' },
//   actions: [],
//   context: undefined,
//   // ...
// }
```

## State Definition

A `State` object instance is JSON-serializable and has the following properties:

- `value` - the current state value (e.g., `{red: 'walk'}`)
- `context` - the current [context](./context.md) of this state
- `event` - the event object that triggered the transition to this state (since 4.2.1)
- `actions` - an array of [actions](./actions.md) to be executed
- `activities` - a mapping of [activities](./activities.md) to `true` if the activity started, or `false` if stopped.
- `history` - the previous `State` instance
- `meta` - any static meta data defined on the `meta` property of the [state node](./statenodes.md)

It contains other properties such as `historyValue`, `events`, `tree`, and others that are generally not relevant and are used internally.

## State Methods and Getters

There are some helpful methods and getters that you can use for a better development experience:

### `state.matches(parentStateValue)`

This method determines whether the current `state.value` is a subset of the given `parentStateValue`; that is, if it "matches" the state value. For example, assuming the current `state.value` is `{ red: 'stop' }`:

```js
console.log(state.value);
// => { red: 'stop' }

console.log(state.matches('red'));
// => true

console.log(state.matches('red.stop'));
// => true

console.log(state.matches({ red: 'stop' }));
// => true

console.log(state.matches('green'));
// => false
```

### `state.nextEvents`

This getter specifies the next events that will cause a transition from the current state:

```js
const { initialState } = lightMachine;

console.log(initialState.nextEvents);
// => ['TIMER', 'EMERGENCY']
```

This is useful in determining which next events can be taken, and representing these potential events in the UI (such as enabling/disabling certain buttons).

### `state.changed`

This getter specifies if this `state` has changed from the previous state. A state is considered "changed" if:

- Its value is not equal to its previous value, or:
- It has any new actions (side-effects) to execute.

An initial state (with no history) will return `undefined`.

```js
const { initialState } = lightMachine;

console.log(initialState.changed);
// => undefined

const nextState = lightMachine.transition(initialState, 'TIMER');

console.log(nextState.changed);
// => true

const unchangedState = lightMachine.transition(nextState, 'UNKNOWN_EVENT');

console.log(unchangedState.changed);
// => false
```

### `state.toStrings()`

This method returns an array of strings that represent _all_ of the state value paths. For example, assuming the current `state.value` is `{ red: 'stop' }`:

```js
console.log(state.value);
// => { red: 'stop' }

console.log(state.toStrings());
// => ['red', 'red.stop']
```

This is useful for representing the current state in string-based environments, such as in CSS classes or data-attributes.

## Persisting State

As mentioned, a `State` object can be persisted by serializing it to a string JSON format:

```js
const jsonState = JSON.stringify(currentState);

// Example: persisting to localStorage
try {
  localStorage.setItem('app-state', jsonState);
} catch (e) {
  // unable to save to localStorage
}
```

State can be rehydrated (i.e., restored) using the static `State.create(...)` method:

```js
import { State, interpret } from 'xstate';
import { myMachine } from '../path/to/myMachine';

// Retrieving state from localStorage
const restoredStateDef = JSON.parse(localStorage.getItem('app-state'));

// Use State.create() to restore state from a plain object
const restoredState = State.create(restoredStateDef);
```

You can then interpret the machine from this restored state by passing the `State` into the `.start(...)` method of the interpreted service:

```js
// ...

// This will start the service at the specified State
const service = interpret(myMachine).start(restoredState);
```

This will also maintain and restore previous [history states](./history.md).

## Notes

- You should seldom (never) have to create a `State` instance manually. Treat `State` as a read-only object that comes from `machine.transition(...)` or `service.onTransition(...)` _only_.
- To prevent memory leaks, `state.history` will not retain its history; that is, `state.history.history === undefined`. Otherwise, we're creating a huge linked list and reinventing blockchain, which I really don't care to do.
  - This behavior may be configurable in future versions.
