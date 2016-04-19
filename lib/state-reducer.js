"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function stateReducer(machine) {
  var initialState = machine.transition();

  return function () {
    var state = arguments.length <= 0 || arguments[0] === undefined ? initialState : arguments[0];
    var action = arguments[1];

    if (!action || !machine.isValidAction(action)) {
      return state;
    }

    return machine.transition(state, action);
  };
}

exports.default = stateReducer;