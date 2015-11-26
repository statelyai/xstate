"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function stateReducer(machine) {
  var initialState = machine.transition();

  return function (state, signal) {
    if (state === undefined) state = initialState;

    if (!signal || !machine.isValidSignal(signal)) {
      return state;
    }

    return machine.transition(state, signal);
  };
}

exports["default"] = stateReducer;
module.exports = exports["default"];