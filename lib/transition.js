'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _signal = require('./signal');

var _signal2 = _interopRequireDefault(_signal);

var Transition = (function () {
  function Transition(data, fromState) {
    _classCallCheck(this, Transition);

    this.event = data.event;

    this.target = data.target;

    this.cond = data.cond || function () {
      return true;
    };
  }

  _createClass(Transition, [{
    key: 'isValid',
    value: function isValid(signal) {
      signal = new _signal2['default'](signal);

      return signal.type === this.event && !!this.cond(signal);
    }
  }]);

  return Transition;
})();

exports['default'] = Transition;
module.exports = exports['default'];