import React from 'react';
import ReactDOM from 'react-dom';
import { createStore, combineReducers } from 'redux';
import { Provider, connect } from 'react-redux';

import {
  machine,
  stateReducer,
  mapOnEntry,
  mapState
} from '../../../lib/index';

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

let messages = {
  'idle.dispensed': 'Enjoy your drink! Please insert a coin for another.',
  'idle.err_insert_coin': 'ERROR: Please insert a coin before making a selection.',
  'wait_for_select.err_processing': 'ERROR: Why are you giving me more coins? Make a selection',
  'dispensing.err_dispensing': 'ERROR: Please wait until your drink is dispensed.'
};

let titles = {
  'idle': 'Please insert a coin.',
  'wait_for_select': 'Please make a selection.',
  'dispensing': 'Please wait; dispensing your selection.',
}

let store = createStore(combineReducers({
  vending: stateReducer(vendingMachine)
}));

class App extends React.Component {
  componentWillReceiveProps(nextProps) {
    let { vending, dispatch } = this.props;

    let action = mapOnEntry({
      'dispensing': {type: 'DISPENSED'}
    }, nextProps.vending, vending);

    action && setTimeout(() => dispatch(action), 2000);
  }

  render() {
    let { dispatch, vending } = this.props;

    return (
      <div>
        <h3>{ mapState(titles, vending) }</h3>
        <button onClick={() => dispatch({type: 'COIN'})}>COIN</button>
        <button onClick={() => dispatch({type: 'SELECT'})}>SELECT</button>
        <div>{ mapState(messages, vending) }</div>
      </div>
    );
  }
}

let ConnectedApp = connect(s => s)(App);

const appElement = document.createElement('div');

document.body.appendChild(appElement);

ReactDOM.render(
  <Provider store={store}>
    <ConnectedApp />
  </Provider>,
  appElement
);