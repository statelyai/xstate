'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _lodashFunctionCurry = require('lodash/function/curry');

var _lodashFunctionCurry2 = _interopRequireDefault(_lodashFunctionCurry);

function actionFilter(filter, stateReducer) {
  if (filter === undefined) filter = function () {
    return true;
  };

  return function (state, action) {
    if (!state) {
      return stateReducer();
    }

    if (!filter(action)) {
      return state;
    }

    return stateReducer(state, action);
  };
}

exports['default'] = (0, _lodashFunctionCurry2['default'])(actionFilter);
module.exports = exports['default'];