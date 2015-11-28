## Vending Machine Example

Inspired by [this article](http://amasad.me/2015/10/31/javascript-async-functions-for-easier-concurrent-programming/).

This example is a simple vending machine app, where there are two inputs (`COIN` and `SELECT`) and 
multiple states. The example is built with [React](https://github.com/facebook/react) and [Redux](https://github.com/rackt/redux), and Estado.

## Quick Start
- `npm start` or open `index.html` in this directory.

### Explanation

First, import all the necessary modules. We want:

- React and ReactDOM in order to display our app and update the DOM when appropriate (i.e., whenever the state changes)
- Redux to manage the state of the app
- Estado to manage the transitions between finite states, as well as mapping UI messages and Redux actions to finite state changes.

```js
import React from 'react';
import ReactDOM from 'react-dom';

import { createStore, combineReducers } from 'redux';
import { Provider, connect } from 'react-redux';

import {
  machine,
  stateReducer,
  mapOnEntry,
  mapState
} from 'estado';
```

Now, let's define our state machine. There's going to be three states:
- **idle** - nothing has happened yet, and the app is waiting for the user to insert a coin (`COIN`).
- **wait_for_select** - the app is waiting for the user to make a selection (`SELECT`).
- **dispensing** - the app is currently dispensing the selection.

However, it's important to take _all_ possible actions from each state into account. What if the user makes a selection instead 
of inserting a coin, or vice-versa? So we introduce some nested states:
- **idle**
  - **.idle** - Nothing has happened yet.
  - **.dispensed** - The app has just dispensed (`DISPENSED`) a selection and is now idle again.
  - **.err_insert_coin** - The user has tried making a selection (`SELECT`) without inserting a coin first.
- **wait_for_select**
  - **.idle** - A selection hasn't been made yet.
  - **.err_processing** - The user tried entering more coins (`COIN`) instead of making a selection.
- **dispensing**
  - **.idle** - The selection is currently dispensing; no further actions have been received.
  - **.err_dispensing** - The user tried making a selection (`SELECT`) or inserting a coin (`COIN`) while the app was dispensing
  the selection.
  
Here's what that state machine will look like:

```js
let vendingMachine = machine(`
idle {
  idle
    -> err_insert_coin (SELECT)
  dispensed
    -> err_insert_coin (SELECT)
  err_insert_coin
    <- (SELECT)
} -> wait_for_select (COIN)

wait_for_select {
  idle 
    -> err_processing (COIN)
  err_processing
    <- (COIN)
} -> dispensing (SELECT)

dispensing {
  idle
    -> err_dispensing (COIN)
    -> err_dispensing (SELECT)
  err_dispensing
    <- (SELECT)
    <- (COIN)
} -> idle.dispensed (DISPENSED)
`);
```

We can map meaningful error messages to various nested states (which isn't required, but recommended for good UI/UX):
```js
let messages = {
  'idle.dispensed': 'Enjoy your drink! Please insert a coin for another.',
  'idle.err_insert_coin': 'ERROR: Please insert a coin before making a selection.',
  'wait_for_select.err_processing': 'ERROR: Why are you giving me more coins? Make a selection',
  'dispensing.err_dispensing': 'ERROR: Please wait until your drink is dispensed.'
};
```

And we can map general title messages for the main states:
```js
let title = {
  'idle': 'Please insert a coin.',
  'wait_for_select': 'Please make a selection.',
  'dispensing': 'Please wait; dispensing your selection.',
};
```

Estado provides a very simple `storeReducer(<Machine>machine) = (state, action) => state'` reducer function that can be used directly with Redux.
It takes the state as a string (such as `"wait_for_select"`) and an action (such as `{type: 'SELECT'}`) and returns a new state as
a string (such as `"dispensing"`).

```js
let store = createStore(combineReducers({
  vending: stateReducer(vendingMachine)
}));
```

Inside of the `App` component, the rendered component only has two responsibilities: to map the current state of the app to the
title and messages (e.g., when in state `"wait_for_select"`, display "Please make a selection."), and to map actions to the buttons.

```js
class App extends React.Component {
  // ...
  
  render() {
    let { dispatch, vending } = this.props;

    return <div>
      <h3>{ mapState(title, vending) }</h3>
      <button onClick={() => dispatch({type: 'COIN'})}>COIN</button>
      <button onClick={() => dispatch({type: 'SELECT'})}>SELECT</button>
      <div>{ mapState(messages, vending) }</div>
    </div>
  }
}
```

Finally, when we initially enter the `"dispensing"` state, we want to trigger an action that has `"DISPENSED"` a
selection asyncronously after 2 seconds. Since all of Estado's functions are side-effect-free, we need to do this in `componentWillReceiveProps`.
Estado provides `mapOnEntry(stateMap, newState, oldState)` and a similar `mapOnExit(stateMap, newState, oldState)` function that
return the mapped value to the entered or exited state. That way, we can appropriately dispatch an action without having to figure out 
ourselves if the state has changed.

```js
class App extends React.Component {
  componentWillReceiveProps(nextProps) {
    let { vending, dispatch } = this.props;

    let action = mapOnEntry({
      'dispensing': {type: 'DISPENSED'}
    }, nextProps.vending, vending);

    if (action) {
      setTimeout(() => dispatch(action), 2000);
    }
  }
  
  // ...
}
```

And the rest is just `connect()`ing Redux to `App` and rendering `App` to the document via `ReactDOM.render()`:
```js
let ConnectedApp = connect(s => s)(App);

const appElement = document.createElement('div');

document.body.appendChild(appElement);

ReactDOM.render(
  <Provider store={store}>
    <ConnectedApp />
  </Provider>,
  appElement
);
```

And that's it! We were able to create a non-trivial finite state machine, handle concurrency (try clicking `COIN` or `SELECT` while 
the selection is dispensing) and have most of our business logic defined declaratively, all in less than 100 lines of code. There's
two important things to notice:
- There's not a single `if/else` statement in this entire app. That logic is hidden away in the state machine.
- The `render()` method contains no logic. It simply ties the two buttons to dispatching actions, and maps appropriate view elements
(title and messages). This makes it very easy to reuse the view logic in other environments, such as React Native.
