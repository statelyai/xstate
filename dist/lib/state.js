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
    var _this = this;

    var parent = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    _classCallCheck(this, State);

    this.id = data.id || 'root';

    this._id = parent ? parent._id + '.' + this.id : this.id;

    this.states = data.states ? data.states.map(function (state) {
      return new State(state, _this);
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
      var _this2 = this;

      var fromState = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
      var signal = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var substateIds = this.getSubstateIds(fromState);
      var initialStates = this.states.filter(function (state) {
        return state.initial;
      });
      var nextStates = [];

      if (substateIds.length) {
        nextStates = this.getState(substateIds[0]).transition(substateIds.slice(1), signal);

        if (!nextStates.length) {
          nextStates = this.transitions.filter(function (transition) {
            return transition.isValid(signal);
          }).map(function (transition) {
            return transition.target;
          });
        } else {
          // nextStates = nextStates
          //   .map((id) => this.getState(id))
          //   .filter(_.identity)
          //   .map((state) => state.getInitialStates())
          //   .reduce((a, b) => a.concat(b), []);
        }
      } else if (initialStates.length) {
          nextStates = initialStates.map(function (state) {
            return state.transition(null, signal);
          }).reduce(function (a, b) {
            return a.concat(b);
          }).map(function (id) {
            return _this2.id + '.' + id;
          });
        } else if (signal) {
          nextStates = this.transitions.filter(function (transition) {
            return transition.isValid(signal);
          }).map(function (transition) {
            return transition.target;
          });
        } else {
          return initialStates.concat(this.id);
        }

      return nextStates;
    }
  }, {
    key: 'getInitialStates',
    value: function getInitialStates() {
      var initialStates = this.states.filter(function (state) {
        return state.initial;
      });

      return initialStates.length ? initialStates.map(function (state) {
        return state._id;
      }) : [this.id];
    }
  }, {
    key: 'getSubstateIds',
    value: function getSubstateIds(fromState) {
      fromState = fromState || [];

      return _lodash2['default'].isArray(fromState) ? fromState : _lodash2['default'].isString(fromState) ? fromState.split(STATE_DELIMITER) : false;
    }
  }, {
    key: 'getState',
    value: function getState(substates) {
      substates = this.getSubstateIds(substates);

      if (!substates.length) {
        return this;
      }

      var substate = this.states.find(function (state) {
        return state.id === substates[0];
      });

      return substate ? substates.length > 1 ? substate.getState(substates.slice(1)) : substate : false;
    }
  }]);

  return State;
})();

exports['default'] = State;
module.exports = exports['default'];