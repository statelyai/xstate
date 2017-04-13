'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _transition = require('./transition');

var _transition2 = _interopRequireDefault(_transition);

var _difference = require('lodash/array/difference');

var _difference2 = _interopRequireDefault(_difference);

var _unique = require('lodash/array/unique');

var _unique2 = _interopRequireDefault(_unique);

var _isArray = require('lodash/lang/isArray');

var _isArray2 = _interopRequireDefault(_isArray);

var _isString = require('lodash/lang/isString');

var _isString2 = _interopRequireDefault(_isString);

var _find = require('lodash/collection/find');

var _find2 = _interopRequireDefault(_find);

var _parser = require('./parser');

var _action = require('./action');

var _action2 = _interopRequireDefault(_action);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var STATE_DELIMITER = '.';

var State = (function () {
  function State(data) {
    var _this = this;

    var parent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    _classCallCheck(this, State);

    data = (0, _isString2.default)(data) ? (0, _parser.parse)(data) : data;

    this.id = data.id || 'root';

    this._id = parent ? parent._id.concat(this.id) : [this.id];

    this.states = data.states ? data.states.map(function (state) {
      return new State(state, _this);
    }) : [];

    this.transitions = data.transitions ? data.transitions.map(function (transition) {
      return new _transition2.default(transition);
    }) : [];

    this.alphabet = this.getAlphabet();

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
      var fromState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

      return (0, _difference2.default)(this._id, fromState._id).join('.');
    }
  }, {
    key: 'transition',
    value: function transition() {
      var fromState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

      var _this3 = this;

      var action = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      var returnFlag = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

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

        nextStates = currentSubstate.transition(substateIds.slice(1), action, false);

        if (!nextStates.length) {
          nextStates = this.transitions.filter(function (transition) {
            return transition.isValid(action);
          }).map(function (transition) {
            return transition.targetState.initialStates();
          }).reduce(function (a, b) {
            return a.concat(b);
          }, []);
        }
      } else if (initialStates.length) {
        nextStates = initialStates.map(function (state) {
          return state.transition(null, action, false);
        }).reduce(function (a, b) {
          return a.concat(b);
        }, []);
      } else if (action) {
        nextStates = this.transitions.filter(function (transition) {
          return transition.isValid(action);
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
      var _initialStates = this.states.filter(function (state) {
        return state.initial;
      });

      return _initialStates.length ? _initialStates.map(function (state) {
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

      return (0, _isArray2.default)(fromState) ? fromState : (0, _isString2.default)(fromState) ? fromState.split(STATE_DELIMITER) : false;
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

      var substate = (0, _find2.default)(this.states, function (state) {
        return state.id === substates[0];
      });

      return substate ? substates.length > 1 ? substate.getState(substates.slice(1)) : substate : false;
    }
  }, {
    key: 'getAlphabet',
    value: function getAlphabet() {
      return this.alphabet || (0, _unique2.default)(this.states.map(function (state) {
        return state.getAlphabet();
      }).concat(this.transitions.map(function (transition) {
        return transition.event;
      })).reduce(function (a, b) {
        return a.concat(b);
      }, []));
    }
  }, {
    key: 'isValidAction',
    value: function isValidAction(action) {
      if (!action) return false;

      var actionType = new _action2.default(action).type;

      return this.getAlphabet().indexOf(actionType) !== -1;
    }
  }]);

  return State;
})();

exports.default = State;