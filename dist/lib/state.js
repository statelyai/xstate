'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _transition = require('./transition');

var _transition2 = _interopRequireDefault(_transition);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var STATE_DELIMITER = '.';

Array.prototype.log = function (msg) {
  console.log(msg, this);

  return this;
};

var State = (function () {
  function State(data) {
    _classCallCheck(this, State);

    this.id = data.id || 'root';

    this.states = data.states ? data.states.map(function (state) {
      return new State(state);
    }) : [];

    this.transitions = data.transitions ? data.transitions.map(function (transition) {
      return new _transition2['default'](transition);
    }) : [];

    this.initial = !!data.initial;

    this.final = !!data.final;
  }

  _createClass(State, [{
    key: 'transition',
    value: function transition() {
      var _this = this;

      var fromState = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
      var signal = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var nextStates = [];

      fromState = this.getState(fromState);

      console.log('fromState = ', fromState.id);

      if (fromState) {
        nextStates = fromState.transition(signal);
      } else {
        nextStates = this.states.filter(function (state) {
          return state.initial;
        }).map(function (state) {
          return state.transition(signal);
        }).reduce(_lodash2['default'].flatten, []);
      }

      if (!nextStates) {
        nextStates = this.transitions.filter(function (transition) {
          return transition.isValid(signal);
        }).map(function (transition) {
          return transition.target;
        });
      }

      return nextStates.length ? nextStates.map(function (id) {
        return _this.id + '.' + id;
      }) : false;
    }
  }, {
    key: 'getState',
    value: function getState(substates) {
      substates = _lodash2['default'].isArray(substates) ? substates : substates.split(STATE_DELIMITER);

      if (!substates || !substates.length) {
        return this;
      }

      var substate = this.states.find(function (state) {
        return state.id === substates[0];
      });

      return substate ? substate.getState(substates.slice(1)) : false;
    }
  }]);

  return State;
})();

exports['default'] = State;
module.exports = exports['default'];