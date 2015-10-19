'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _lodashFunctionCurry = require('lodash/function/curry');

var _lodashFunctionCurry2 = _interopRequireDefault(_lodashFunctionCurry);

function signalFilter(filter, stateReducer) {
  if (filter === undefined) filter = function () {
    return true;
  };

  return function (state, signal) {
    if (!state) {
      return stateReducer();
    }

    if (!filter(signal)) {
      return state;
    }

    return stateReducer(state, signal);
  };
}

exports['default'] = (0, _lodashFunctionCurry2['default'])(signalFilter);
module.exports = exports['default'];