# Interpreting Machines

While a state machine/statechart with a pure `.transition()` function is useful for flexibility, purity, and testability, in order for it to have any use in a real-life application, something needs to:

- Keep track of the current state, and persist it
- Execute side-effects
- Handle delayed transitions and events
- Communicate with external services

The **interpreter** is responsible for _interpreting_ the state machine/statechart and doing all of the above - that is, parsing and executing it in a runtime environment. An interpreted, running instance of a statechart is called a **service**.

## Interpreter

Since version 4.0, XState provides an (optional) interpreter that you can use to run your statecharts. The interpreter handles:

- State transitions
- Executing actions (side-effects)
- Delayed events with cancellation
- Activities (ongoing actions)
- Invoking/spawning child statechart services
- Support for multiple listeners for state transitions, context changes, events, etc.
- And more!

```js
import { Machine, interpret } from 'xstate';

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

## Transitions

Listeners for state transitions are registered via the `.onTransition(...)` method, which takes a state listener. State listeners are called every time a state transition (including the initial state) happens, with the current [`state` instance](./states.md):

```js
// Interpret the machine
const service = interpret(machine);

// Add a state listener, which is called whenever a state transition occurs.
service.onTransition(nextState => {
  console.log(nextState.value);
});

service.start();
```

## Starting and Stopping

The service can be initialized (i.e., started) and stopped with `.start()` and `.stop()`. Calling `.start()` will immediately transition the service to its initial state. Calling `.stop()` will remove all listeners from the service, and do any listener cleanup, if applicable.

```js
const service = interpret(machine);

// Start the machine
service.start();

// Stop the machine
service.stop();

// Restart the machine
service.start();
```

Services can be started from a specific [state](./states.md) by passing the `state` into `service.start(state)`. This is useful when rehydrating the service from a previously saved state.

```js
// Starts the service from the specified state,
// instead of from the machine's initial state.
service.start(previousState);
```

## Executing Actions

[Actions (side-effects)](./actions.md) are, by default, executed immediately when the state transitions. This is configurable by setting the `{ execute: false }` option (see example). Each action object specified on the `state` might have an `.exec` property, which is called with the state's `context` and `event` object.

Actions can be executed manually by calling `service.execute(state)`. This is useful when you want to control when actions are executed:

```js
const service = interpret(machine, {
  execute: false // do not execute actions on state transitions
});

service.onTransition(state => {
  // execute actions on next animation frame
  // instead of immediately
  requestAnimationFrame(() => service.execute(state));
});

service.start();
```

## Options

The following options can be passed into the interpreter as the 2nd argument (`interpret(machine, options)`):

- `execute` (boolean) - Signifies whether state actions should be executed upon transition. Defaults to `true`.
  - See [Executing Actions](#executing-actions) for customizing this behavior.
- `deferEvents` (boolean) - Signifies whether events sent to an uninitialized service (i.e., prior to calling `service.start()`) should be deferred until the service is initialized. Defaults to `true`.
  - If `false`, events sent to an uninitialized service will throw an error.
  - Since 4.4
- `devTools` (boolean) - Signifies whether events should be sent to the [Redux DevTools extension](https://github.com/zalmoxisus/redux-devtools-extension). Defaults to `false`.
- `logger` - Specifies the logger to be used for `log(...)` actions. Defaults to the native `console.log` method.

## Custom Interpreters

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

## Notes

- The `interpret` function is exported directly from `xstate` since 4.3.0 (i.e., `import { interpret } from 'xstate'`). For prior versions, it is imported from `'xstate/lib/interpreter'`.
- Most interpreter methods can be chained:

```js
const service = interpret(machine)
  .onTransition(state => console.log(state))
  .onDone(() => console.log('done'))
  .start(); // returns started service
```

- Do not call `service.send(...)` directly from actions. This impedes testing, visualization, and analysis. Instead, [use `invoke`](./communication.md).
