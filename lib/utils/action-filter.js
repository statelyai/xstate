'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _curry = require('lodash/function/curry');

var _curry2 = _interopRequireDefault(_curry);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function actionFilter() {
  var filter = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {
    return true;
  };
  var stateReducer = arguments[1];

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

exports.default = (0, _curry2.default)(actionFilter);