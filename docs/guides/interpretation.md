# Interpreting machines

While a state machine/statechart with a pure `.transition()` function is useful for flexibility, purity, and testability, in order for it to have any use in a real-life application, something needs to:

- Keep track of the current state, and persist it
- Execute side-effects
- Handle delayed transitions and events
- Communicate with external services

The **interpreter** is responsible for _interpreting_ the state machine/statechart and doing all of the above - that is, parsing and executing it in a runtime environment. An interpreted, running instance of a statechart is called a **service**.

## The XState interpreter

Since version 4.0, XState provides an (optional) interpreter that you can use to run your statecharts. The interpreter handles:

- State transitions
- Executing actions (side-effects)
- Delayed events with cancellation
- Activities (ongoing actions)
- Invoking/spawning child statechart services
- Support for multiple listeners for state transitions, context changes, events, etc.
- And more!

```js
import { Machine } from 'xstate';
import { interpret } from 'xstate/lib/interpreter';

const machine = Machine(/* machine config */);

// Interpret the machine, and add a listener for whenever a transition occurs.
const service = interpret(machine).onTransition(nextState => {
  console.log(nextState.value);
});

// Start the service
service.start();

// Send events
service.send('SOME_EVENT');

// Stop the service when you are no longer using it.
service.stop();
```

## Custom interpreters

You may use any interpreter (or create your own) to run your state machine/statechart. Here's an example minimal implementation that demonstrates how flexible interpretation can be (despite the amount of boilerplate):

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
