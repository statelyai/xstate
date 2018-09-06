# Interpretation
(since 4.0)

While a "stateless" state machine/statechart is useful for flexibility, purity, and testability, in order for it to have any use in a real-life application, something needs to:

- Keep track of the current state, and persist it
- Execute side-effects
- Handle delayed transitions and events

The **interpreter** is responsible for _interpreting_ the statechart and doing all of the above - that is, parsing and executing it in a runtime environment. A simple interpreter might look like this:

```js
const machine = Machine(/* machine config */);

// Keep track of the current state, and start
// with the initial state
let currentState = machine.initialState;

// Keep track of the listeners
const listeners = new Set();

// Have a way of sending/dispatching events
function send(event) {
  // Remember: machine.transition() is a pure function
  currentState = machine.transition(currentState, event);

  // Get the side-effect actions to execute
  const { actions } = currentState;

  actions.forEach(action => {
    // If the action is executable, execute it
    action.exec && action.exec();
  });

  // Notify the listeners
  listeners.forEach(listener => listener(currentState));
}

function listen(listener) {
  listeners.add(listener);
}

function unlisten(listener) {
  listeners.delete(listener);
}

// Now you can listen and send events to update state
listen(state => {
  console.log(state.value);
});

send('SOME_EVENT');
```

This will work, and demonstrates how flexible interpretation can be - you can create your own interpreter. However, it is a lot of boilerplate.

Thankfully, `xstate@4` ships with an optional interpreter:

```js
import { interpret } from 'xstate/lib/interpreter';

const machine = Machine(/* machine config */);

// Create an interpreter for the machine
const interpreter = interpret(machine);

// Add a listener
const listener = (state) => {
  console.log(state.value);
};

interpreter.onTransition(listener);

// Initialize the interpreter
interpreter.init();

// Send events
interpreter.send('SOME_EVENT');

// Unlisten to prevent memory leaks
interpreter.off(listener);
```
