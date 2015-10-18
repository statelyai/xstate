'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _lodashFunctionCurry = require('lodash/function/curry');

var _lodashFunctionCurry2 = _interopRequireDefault(_lodashFunctionCurry);

function stateReducer(machine, signalMapper) {
  return function (state, action) {
    var signal = signalMapper(action);

    if (!signal) {
      return state || machine.transition(state);
    }

    return machine.transition(state, signal);
  };
}

exports['default'] = (0, _lodashFunctionCurry2['default'])(stateReducer);
module.exports = exports['default'];