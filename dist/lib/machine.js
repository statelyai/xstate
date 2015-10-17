'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x3, _x4, _x5) { var _again = true; _function: while (_again) { var object = _x3, property = _x4, receiver = _x5; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x3 = parent; _x4 = property; _x5 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _state = require('./state');

var _state2 = _interopRequireDefault(_state);

var _lodashFunctionCurry = require('lodash/function/curry');

var _lodashFunctionCurry2 = _interopRequireDefault(_lodashFunctionCurry);

var Machine = (function (_State) {
  _inherits(Machine, _State);

  function Machine(data, options) {
    _classCallCheck(this, Machine);

    _get(Object.getPrototypeOf(Machine.prototype), 'constructor', this).call(this, data);

    this.options = options;

    this.mapStateRefs();
  }

  _createClass(Machine, [{
    key: 'transition',
    value: function transition() {
      var fromState = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
      var signal = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var states = _get(Object.getPrototypeOf(Machine.prototype), 'transition', this).call(this, fromState, signal);

      // console.log(states, states[0]);

      if (this.options.deterministic) {
        return states.length ? states[0] : false;
      }

      return states;
    }
  }]);

  return Machine;
})(_state2['default']);

exports['default'] = Machine;
module.exports = exports['default'];