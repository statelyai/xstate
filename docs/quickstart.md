# Quick Start

Let's say we're developing an app that retrieves Star Wars data from [The Star Wars API](https://swapi.co). To accomplish this, we'll be dealing with asynchronous API requests in the form of promises.

A promise is [just a state machine](https://www.promisejs.org/implementing/) with 3 states:
- `'pending'` - the Promise has not yet been resolved or rejected
- `'fulfilled'` - the Promise has succeeded and has been resolved
- `'rejected'` - the Promise has failed and has been rejected

When starting the app, no promises have been made yet. We can represent this with the initial `'idle'` state. Let's go ahead and use `xstate` to model this state machine.

## Installation

First, install `xstate` into your project (more details in [the readme](README#installation)):

```bash
npm install xstate --save
```

Then, import the `Machine` function into your application code:

```js
// index.js
import { Machine } from 'xstate';
```

## Creating the Finite State Machine

A simple finite state machine in `xstate` is configured with two properties:
- `initial` - the initial state (in this case, `'idle'`)
- `states` - an object mapping **state keys** to their state configuration.

To start, the states will be configured with an `on` property, which is an object mapping **events** to their **next state keys**:

```js
const starWarsMachine = Machine({
  // start in the 'idle' state
  initial: 'idle',
  states: {
    idle: {
      on: {
        // when a 'REQUEST' event occurs in the 'idle' state,
        // transition to the 'pending' state
        REQUEST: 'pending'
      }
    },
    pending: {
      on: {
        // when a 'pending' promise receives a 'SUCCESS' event,
        // transition to the 'fulfilled' state
        SUCCESS: 'fulfilled',
        // however, when a 'pending' promise receives a 'FAILURE' event,
        // transition to the 'rejected' state instead
        FAILURE: 'rejected'
      }
    },
    fulfilled: {
      on: {
        // our machine can allow a request to be made multiple times,
        // so allow a transition back to 'pending' upon a 'REQUEST' event.
        REQUEST: 'pending'
      }
    },
    rejected: {
      on: {
        // similarly, in case of failure, allow the user to try again.
        REQUEST: 'pending'
      }
    }
  }
});
```

## Transitions

The main purpose of this machine is to allow you, the developer, to answer the question "When the app is in a certain state, and an event occurs, what will the next state be?" To do this with `xstate`, we'll use the `.transition` method which takes two arguments:
- `stateValue` - the state we want to transition from (we'll use string keys for now)
- `event` - the event that occurred (we'll use a string event name for now)

```js
console.log(starWarsMachine
  .transition('idle', 'REQUEST')
  .value);
// => 'pending'

console.log(starWarsMachine
  .transition('pending', 'SUCCESS')
  .value);
// => 'fulfilled'

console.log(starWarsMachine
  .transition('pending', 'REQUEST')
  .value);
// => 'pending'
// notice how the state does not (and should not) change!

console.log(starWarsMachine
  .transition('fulfilled', 'REQUEST')
  .value);
// => 'pending'
```

There's two things to keep in mind:
- The `.transition(...)` function is a _pure function_, meaning it always returns the same value given the same arguments, and it never causes any side effects. We'll get to purposeful side effects (actions) later.
- We need to extract the value from the result using `.value`. This is because `.transition(...)` actually returns a `State` instance, which looks like this:

```js
starWarsMachine.transition('idle', 'REQUEST');

// State {
//   value: 'pending',
//   history: undefined,
//   actions: []
// }
```

## Actions

Pure functions are nice, but apps have to have side-effects in order to actually do anything. In `xstate` (and in the statechart specification) an **action** is a side-effect (or a _reaction_) that can occur on 3 potential instances:
- when a state is _entered_ (`onEntry`)
- when a state is _exited_ (`onExit`)
- when a transition occurs (transition `actions`)

Actions are specified by strings (or arrays of strings):

```js
const starWarsMachine = Machine({
  // ...
  states: {
    idle: {
      on: {
        REQUEST: {
          // note how 'pending' is an object with a single key,
          // instead of a string
          pending: {
            // the `actions` prop specifies which actions should be
            // executed on this idle --> pending transition
            actions: ['alertStartingFirstRequest']
          }
        }
      },
      onExit: 'alertMayTheForceBeWithYou'
    },
    pending: {
      on: {
        SUCCESS: 'fulfilled',
        FAILURE: 'rejected'
      }
      onEntry: 'alertPending',
      onExit: 'alertRequestFinished'
    },
  }
});

const nextState = starWarsMachine.transition('idle', 'REQUEST');

// State {
//   value: 'pending',
//   history: undefined,
//   actions: [
//     'alertMayTheForceBeWithYou',
//     'alertStartingFirstRequest',
//     'alertPending'
//   ]
// }
```

The actions to be executed are an array on the `actions` `State` instance. The action order goes:
1. any `onExit` actions of child states
2. any `onExit` actions of parent states
3. any `actions` on transitions
4. any `onEntry` actions of parent states
5. any `onEntry` actions of child states

