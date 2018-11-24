# State

A state in XState represents the finite state of your application. It is immutable, and it is up to you to decide how you want to propagate these state values into your atomic application state.

## `new State(value, history?, actions?)`

Instantiates a new `State` instance. Typically, you will seldom need to create a new `State` instance, except possibly when testing.

**Arguments:**

- `value`: `StateValue`
  - e.g., `'green'` or `{ red: 'walk' }`
- `history?`: `State` (default: `undefined`)
  - the previous state, if it exists
- `actions?`: `Action[]` (default: `[]`)
  - the set of actions to be executed

**Usage:** See the [`lightMachine`](examples/light.md) from the examples.

```js
console.log(lightMachine.initialState); // returns a State instance
// => State {
//   value: 'green',
//   history: undefined,
//   actions: [], // any onEntry actions for 'green'
// }

console.log(lightMachine.transition(lightMachine.initialState, 'TIMER'));
// => State {
//   value: 'yellow',
//   history: new State('green'), // same as above
//   actions: [], // any onExit actions from 'green', onEntry actions for 'yellow', etc.
// }
```

# State properties

## `state.value`

(`StateValue`) The value (`string` or `object`) representing the finite state.

**Usage:**

```js
const nextState = lightMachine.transition(lightMachine.initialState, 'TIMER');
console.log(nextState.value);
// => 'green'

console.log(parallelMachine.initialState.value);
// => {
//   upload: 'idle',
//   download: 'idle'
// }
```

# State static methods

## `State.from(stateValue)`

Creates a new `State` from the provided `stateValue`.

**Arguments:**

- `stateValue`: `StateValue | State`
  - e.g., `'green'` or `'red.walk'` or `{ red: 'walk' }`

**Returns:** `State`

**Usage:**

```js
const greenState = State.from('green');
console.log(greenState);
// => State {
//   value: 'green',
//   history: undefined,
//   actions: []
// }
```

## `State.inert(stateValue)`

Creates a new `State` from the provided `stateValue` with no `actions` (i.e., inert).

**Arguments:**

- `stateValue`: `StateValue | State`

**Returns:** `State`

**Usage:**

```js
const stateWithActions = new State('green', undefined, ['enterGreen']);
const stateWithoutActions = State.inert(stateWithActions);
console.log(stateWithoutActions);
// => State {
//   value: 'green',
//   history: undefined,
//   actions: []
// }
```
