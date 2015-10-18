"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
function stateReducer(machine) {
  return function (state, signal) {
    return machine.transition(state, signal);
  };
}

exports["default"] = stateReducer;
module.exports = exports["default"];