# Actions and side-effects

For a statechart to be useful in a real-world application, side-effects need to happen. In statecharts and XState, side-effects are declaratively represented by **actions**. When `machine.transition(...)` is called, the `State` returned will provide an array of `actions` that an interpreter can then execute.

There are three types of actions:

- `onEntry` actions are executed upon entering a state
- `onExit` actions are executed upon exiting a state
- transition actions are executed when a transition is taken.

These are represented in the StateNode definition:

```js
const triggerMachine = Machine(
  {
    id: 'trigger',
    initial: 'inactive',
    states: {
      inactive: {
        on: {
          TRIGGER: {
            target: 'active',
            // transition actions
            actions: ['activate', 'sendTelemetry']
          }
        }
      },
      active: {
        // entry actions
        onEntry: ['notifyActive', 'sendTelemetry'],
        // exit actions
        onExit: ['notifyInactive', 'sendTelemetry'],
        on: {
          STOP: 'inactive'
        }
      }
    }
  },
  {
    actions: {
      // action implementations
      activate: (ctx, event) => {
        console.log('activating...');
      },
      notifyActive: (ctx, event) => {
        console.log('active!');
      },
      notifyInactive: (ctx, event) => {
        console.log('inactive!');
      },
      sendTelemetry: (ctx, event) => {
        console.log('time:', Date.now());
      }
    }
  }
);
```

The `State` instance returned from a transition has an `actions` property, which is an array of action objects for the interpreter to execute:

```js
const activeState = triggerMachine.transition('inactive', 'TRIGGER');

activeState.actions;
// [
//   { type: 'activate', exec: ... },
//   { type: 'sendTelemetry', exec: ... },
//   { type: 'notifyActive', exec: ... },
//   { type: 'sendTelemetry', exec: ... }
// ]
```

Each action object has two properties (and possibly others):

- `type` - the action type
- `exec` - the action implementation function

The `exec` function takes two arguments:

- `ctx` - the current machine context
- `event` - the event that caused the transition

An interpreter would call the `exec` function with the `currentState.context` and the `event`.

## Action order

When interpreting statecharts, the order of actions should not necessarily matter (that is, they should not be dependent on each other). However, the order of the actions in the `state.actions` array is:

1. `onExit` actions - all the exit actions of the exited states, from the atomic state node up
2. transition `actions` - all actions defined on the chosen transition
3. `onEntry` actions - all the entry actions of the entered states, from the parent state down

## Built-in Actions

### Send Action

The `send(event)` action creator queues an event to the machine, in the external event queue. This means the event is sent on the next "step" of the interpreter.

```js
import { Machine, actions } from 'xstate';
const { send } = actions;

const lazyStubbornMachine = Machine({
  id: 'stubborn',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: {
          target: 'active',
          // send the TOGGLE event again to the service
          actions: send('TOGGLE')
        }
      }
    },
    active: {
      on: {
        TOGGLE: 'inactive'
      }
    }
  }
});

const nextState = lazyStubbornMachine.transition('inactive', 'TOGGLE');

nextState.value;
// => 'active'
nextState.actions;
// => [{ type: 'xstate.send', event: { type: 'TOGGLE' }}]

// The service will proceed to send itself the { type: 'TOGGLE' } event.
```

The `event` argument passed to `send(event)` can be:

- A string event, e.g., `send('TOGGLE')`
- An event object, e.g., `send({ type: 'TOGGLE', payload: ... })`
- An event expression, which is a function that takes in the current `context` and `event` that triggered the `send()` action, and returns an event object:

```js
import { actions } from 'xstate';
const { send } = actions;

// contrived example - reads from the `ctx` and sends
// the dynamically created event
const sendName = send((ctx, event) => ({
  type: 'NAME',
  name: ctx.user.name
}));

const machine = Machine({
  // ...
  on: {
    TOGGLE: {
      actions: sendName
    }
  }
  //...
});
```

### Raise Action

The `raise()` action creator queues an event to the statechart, in the internal event queue. This means the event is immediately sent on the current "step" of the interpreter.

```js
import { Machine, actions } from 'xstate';
const { raise } = actions;

const stubbornMachine = Machine({
  id: 'stubborn',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: {
          target: 'active',
          // immediately consume the TOGGLE event
          actions: raise('TOGGLE')
        }
      }
    },
    active: {
      on: {
        TOGGLE: 'inactive'
      }
    }
  }
});

const nextState = stubbornMachine.transition('inactive', 'TOGGLE');

nextState.value;
// => 'inactive'
nextState.actions;
// => []
```

### Log Action

The `log()` action creator is a declarative way of logging anything related to the current state `context` and/or `event`. It takes two optional arguments:

- `expr` (optional) - a function that takes the `context` and `event` as arguments and returns a value to be logged
- `label` (optional) - a string to label the logged message

```js
import { Machine, actions } from 'xstate';
const { raise } = actions;

const loggingMachine = Machine({
  id: 'logging',
  context: { count: 42 },
  initial: 'start',
  states: {
    start: {
      on: {
        FINISH: {
          target: 'end',
          actions: log(
            (ctx, event) => `count: ${ctx.count}, event: ${event.type}`,
            'Finish label'
          )
        }
      }
    },
    end: {}
  }
});

const endState = loggingMachine.transition('start', 'FINISH');

endState.actions;
// [
//   {
//     type: 'xstate.log',
//     label: 'Finish label',
//     expr: (ctx, event) => ...
//   }
// ]

// The interpreter would log the action's evaluated expression
// based on the current state context and event.
```

Without any arguments, `log()` is an action that logs an object with `context` and `event` properties, containing the current context and triggering event, respectively.

## Actions on self-transitions

A self-transition is when a state transitions to itself, in which it _may_ exit and then reenter itself. Self-transitions can either be an **internal** or **external** transition:

- An internal transition will _not_ exit and reenter itself, so the state node's `onEntry` and `onExit` actions will not be executed again.
  - Internal transitions are indicated with `{ internal: true }`, or by leaving the `target` as `undefined`.
  - Actions defined on the transition's `actions` property will be executed.
- An external transition _will_ exit and reenter itself, so the state node's `onEntry` and `onExit` actions will be executed again.
  - All transitions are external by default. To be explicit, you can indicate them with `{ internal: false }`.
  - Actions defined on the transition's `actions` property will be executed.

For example, this counter machine has one `'counting'` state with internal and external transitions:

```js
const counterMachine = Machine({
  id: 'counter',
  initial: 'counting',
  states: {
    counting: {
      onEntry: 'enterCounting',
      onExit: 'exitCounting',
      on: {
        // self-transitions
        INC: { actions: 'increment' }, // internal (implicit)
        DEC: { target: 'counting', actions: 'decrement' }, // external
        DO_NOTHING: { internal: true, actions: 'logNothing' } // internal (explicit)
      }
    }
  }
});

// External transition (onExit + transition actions + onEntry)
const stateA = counterMachine.transition('counting', 'DEC');
stateA.actions;
// ['exitCounting', 'decrement', 'enterCounting']

// Internal transition (transition actions)
const stateB = counterMachine.transition('counting', 'DO_NOTHING');
stateB.actions;
// ['logNothing']

const stateC = counterMachine.transition('counting', 'INC');
stateB.actions;
// ['increment']
```
