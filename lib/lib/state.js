'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _transition = require('./transition');

var _transition2 = _interopRequireDefault(_transition);

var _lodashArrayDifference = require('lodash/array/difference');

var _lodashArrayDifference2 = _interopRequireDefault(_lodashArrayDifference);

var _lodashLangIsArray = require('lodash/lang/isArray');

var _lodashLangIsArray2 = _interopRequireDefault(_lodashLangIsArray);

var _lodashLangIsString = require('lodash/lang/isString');

var _lodashLangIsString2 = _interopRequireDefault(_lodashLangIsString);

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

    this._id = parent ? parent._id.concat(this.id) : [this.id];

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
    key: 'mapStateRefs',
    value: function mapStateRefs() {
      var _this2 = this;

      this.states = this.states.map(function (state) {
        state.transitions = state.transitions.map(function (transition) {
          transition.targetState = _this2.getState(transition.target);

          return Object.freeze(transition);
        });

        return state.mapStateRefs();
      });

      return Object.freeze(this);
    }
  }, {
    key: 'relativeId',
    value: function relativeId() {
      var fromState = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      return (0, _lodashArrayDifference2['default'])(this._id, fromState._id).join('.');
    }
  }, {
    key: 'transition',
    value: function transition() {
      var fromState = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      var _this3 = this;

      var signal = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];
      var returnFlag = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

      var substateIds = this.getSubstateIds(fromState);
      var initialStates = this.states.filter(function (state) {
        return state.initial;
      });
      var nextStates = [];
      var currentSubstate = substateIds.length ? this.getState(substateIds[0]) : null;

      if (substateIds.length) {
        if (!currentSubstate) {
          return [];
        }

        nextStates = currentSubstate.transition(substateIds.slice(1), signal, false);

        if (!nextStates.length) {
          nextStates = this.transitions.filter(function (transition) {
            return transition.isValid(signal);
          }).map(function (transition) {
            return transition.targetState.initialStates();
          }).reduce(function (a, b) {
            return a.concat(b);
          }, []);
        }
      } else if (initialStates.length) {
        nextStates = initialStates.map(function (state) {
          return state.transition(null, signal, false);
        }).reduce(function (a, b) {
          return a.concat(b);
        }, []);
      } else if (signal) {
        nextStates = this.transitions.filter(function (transition) {
          return transition.isValid(signal);
        }).map(function (transition) {
          return transition.targetState.initialStates();
        }).reduce(function (a, b) {
          return a.concat(b);
        }, []);
      } else {
        nextStates = this.initialStates();
      }

      return returnFlag ? nextStates.map(function (state) {
        return state.relativeId(_this3);
      }) : nextStates;
    }
  }, {
    key: 'initialStates',
    value: function initialStates() {
      var initialStates = this.states.filter(function (state) {
        return state.initial;
      });

      return initialStates.length ? initialStates.map(function (state) {
        return state.initialStates();
      }).reduce(function (a, b) {
        return a.concat(b);
      }, []) : [this];
    }
  }, {
    key: 'getSubstateIds',
    value: function getSubstateIds(fromState) {
      if (!fromState) return [];

      if (fromState instanceof State) {
        return fromState._id;
      }

      fromState = fromState || [];

      return (0, _lodashLangIsArray2['default'])(fromState) ? fromState : (0, _lodashLangIsString2['default'])(fromState) ? fromState.split(STATE_DELIMITER) : false;
    }
  }, {
    key: 'getState',
    value: function getState(substates) {
      if (substates instanceof State) {
        return substates;
      }

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