# Complete Guide

This is a guide that takes you through all the important parts of `xstate` and statecharts by building a sample app.

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

![Star Wars Promise State Machine](https://i.imgur.com/4qXh3Jx.png)

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
      onEntry: 'fetchPerson',
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
//     'fetchPerson'
//   ]
// }
```

The actions to be executed are an array on the `actions` `State` instance. The action order goes:
1. any `onExit` actions of child states
2. any `onExit` actions of parent states
3. any `actions` on transitions
4. any `onEntry` actions of parent states
5. any `onEntry` actions of child states

From here, executing actions (side-effects) in your app is completely up to you. Here's one way of doing it:

```js
const actionMap = {
  alertStartingFirstRequest: () => alert('Starting first request!'),
  alertMayTheForceBeWithYou: () => alert('May the force be with you.'),
  fetchPerson: ({ id }, dispatch) => fetch(`https://swapi.co/api/people/${id}`)
    .then(res => res.json())
    .then(res => dispatch({
      type: 'SUCCESS',
      payload: res
    }))
    .catch(err => dispatch({
      type: 'FAILURE',
      error: err
    })),
  alertRequestFinished: () => alert('Request finished!'),  
};

// atomic state - there are many different ways to update this
let currentState = starWarsMachine.initialState; // 'idle'

function dispatch(event) {
  const nextState = starWarsMachine
    .transition(currentState, event);

  nextState.actions.forEach(actionKey => {
    const action = actionMap[actionKey];

    if (action) {
      // in this example, `dispatch` is passed into the action
      // in case the action emits other events
      action(event, dispatch);
    }
  });

  // update the atomic state (yes, there's better ways of doing this)
  currentState = nextState.value;
}

// this event can come from anywhere, e.g., the UI
const requestEvent = {
  type: 'REQUEST',
  id: 3
};

// similar to Redux, this can be the result of a button click, an internal action, etc.
dispatch(requestEvent);
```

There's a couple things happening here:
- An `actionMap` is defined, which maps string action keys to their actual implementation. This means you can _reuse_ the exact same statechart in other applications, frameworks, or environments, where the implementation might be different. 💥
- Each action function takes in the `event` data, as well as a `dispatch` (or `emit`) function if the action will dispatch more events.

When an `event` is dispatched:
- First the `nextState` will be determined.
- Then, the `actions` from that state will be executed in order.

And from that, you have a working app!

## Hierarchical (Nested) States

Suppose we want to retrieve data from the API about:
- A Star Wars person
- That person's planet.

We'll have to make two API calls, and we might want to show more detail in the UI for when:
- The person is finished loading
- The person's planet is finished loading.

Hierarchical states (or nested states) can provide more granularity without making the state machine needlessly complex. Here's how we can represent our new requirements:

![Star Wars Statechart](https://i.imgur.com/BHEHhNc.png)

```js
const starWarsMachine = Machine({
  initial: 'idle',
  states: {
    idle: {
      on: { REQUEST: 'pending' }
    },
    pending: {
      initial: 'loadingPerson',
      states: {
        loadingPerson: {
          on: {
            SUCCESS_PERSON: 'loadingPlanet'
          },
          onEntry: 'fetchPerson'
        },
        loadingPlanet: {
          onEntry: 'fetchPlanet'
        }
      },
      on: {
        SUCCESS_PLANET: 'fulfilled',
        FAILURE_PERSON: 'rejected',
        FAILURE_PLANET: 'rejected'
      }
    },
    fulfilled: {
      on: { REQUEST: 'pending' },
      onEntry: 'log'
    },
    rejected: {
      on: { REQUEST: 'pending' }
    }
  }
});
```

Here's what will happen when a request is made now:
1. From the initial `'idle'` state, a `'REQUEST'` event will trigger a transition to the `'pending'` state
2. The `'pending'` state itself has two substates: the initial `'loadingPerson'` and `'loadingPlanet'` states. Entering the `'pending'` state is equivalent to entering its initial state, `'pending.loadingPerson'`.
3. The `onEntry` action of `'pending.loadingPerson'`, which is `'fetchPerson'`, will be executed (remember: `xstate` does not do this, you do!)
4. If successful, a `'SUCCESS_PERSON'` event will be dispatched, which will trigger a transition to the `'pending.loadingPlanet'` state.
5. The `onEntry` action of `'pending.loadingPlanet'` (`'fetchPlanet'`) will then be executed.
6. If successful, a `'SUCCESS_PLANET'` event will be dispatched.

Here, it gets interesting. You'll notice that `'pending.loadingPlanet'` does _not_ have a transition on the `'SUCCESS_PLANET'` event (or any transition, for that matter). In this case, the event will be handled by the **parent state**, which is `'pending'`. From there, `'pending'` will transition to the `'fulfilled'` state according to the config.

Also, the representation of state values for nested states is now object-based:

```js
starWarsMachine.transition('idle', { type: 'REQUEST', id: 3 });

// State {
//   value: { pending: 'loadingPerson' },
//   history: undefined,
//   actions: ['fetchPerson']
// }
```

Here, `{ pending: 'loadingPerson' }` represents that the app is in the `'pending'` state, and that the `'pending'` state is in the `'loadingPerson'` state. It's useful to represent state values in a tree structure this way, since we'll see in the future that you can be in more than one state (parallel states) at the same time, and that states can be deeply nested.

So what does all this look like in code?

```js
// revise the action map
const actionMap = {
  fetchPerson: ({ id }, dispatch) => fetch(`https://swapi.co/api/people/${id}`)
    .then(res => res.json())
    .then(res => dispatch({
      type: 'SUCCESS_PERSON',
      payload: res
    }))
    .catch(err => dispatch({
      type: 'FAILURE_PERSON',
      error: err
    })),
  fetchPlanet: ({ payload }, dispatch) => fetch(payload.homeworld)
    .then(res => res.json())
    .then(res => dispatch({
      type: 'SUCCESS_PLANET',
      payload: res
    }))
    .catch(err => dispatch({
      type: 'FAILURE_PLANET',
      error: err
    })),
  logResult: ({ payload }) => console.log(payload)
};

const id = prompt('Star Wars person ID'); // e.g., 3

// ... (same currentState + dispatch code as before)

dispatch({ type: 'REQUEST', id });
// will eventually log (if successful):
// {
//   name: 'Naboo',
//   climate: 'temperate',
//   ... etc.
// }
```

To be continued!
