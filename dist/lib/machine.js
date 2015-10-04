'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _state = require('./state');

var _state2 = _interopRequireDefault(_state);

var STATE_DELIMITER = '.';

var Machine = (function () {
  function Machine(data) {
    _classCallCheck(this, Machine);

    this.states = data.states ? data.states.map(function (state) {
      return new _state2['default'](state);
    }) : [];
  }

  _createClass(Machine, [{
    key: 'transition',
    value: function transition() {
      var fromState = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
      var signal = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      if (!(fromState || signal)) {
        return this.states.filter(function (state) {
          return state.initial;
        }).map(function (state) {
          return state.transition();
        });
      }

      return this.states.filter(function (state) {
        return state.id === fromState;
      }).map(function (state) {
        return state.transition(signal);
      }).reduce(function (a, b) {
        return a.concat(b);
      }, []);
    }
  }, {
    key: 'getState',
    value: function getState(id) {
      var substates = _.isArray(id) ? id : id.split(STATE_DELIMITER);

      var substate = this.states.find(function (state) {
        return state.id === substates[0];
      });

      return substate ? substate.getState(substates.slice(1)) : false;
    }
  }]);

  return Machine;
})();

exports['default'] = Machine;
module.exports = exports['default'];