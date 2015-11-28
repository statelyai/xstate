"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function stateReducer(machine) {
  var initialState = machine.transition();

  return function (state, action) {
    if (state === undefined) state = initialState;

    if (!action || !machine.isValidAction(action)) {
      return state;
    }

    return machine.transition(state, action);
  };
}

exports["default"] = stateReducer;
module.exports = exports["default"];