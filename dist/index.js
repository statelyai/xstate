'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

exports.machine = machine;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

if (!global._babelPolyfill) {
  require('babel-core/polyfill');
}

var Machine = (function () {
  function Machine(signals, states, initialState, transitionFn) {
    var finalStates = arguments.length <= 4 || arguments[4] === undefined ? [] : arguments[4];

    _classCallCheck(this, Machine);

    this.signals = signals;
    this.states = states;
    this.initialState = initialState;
    this.transitionFn = transitionFn;
    this.finalStates = finalStates;
  }

  _createClass(Machine, [{
    key: 'transition',
    value: function transition(stateName) {
      var symbol = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var state = this.states.find(function (state) {
        return state.name === stateName;
      });

      return this.transitionFn(state, symbol);
    }
  }]);

  return Machine;
})();

var State = function State(name) {
  var transitionMap = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  _classCallCheck(this, State);

  this.name = name;

  this.transitions = Object.keys(transitionMap).map(function (toState) {
    return new Transition(name, toState, transitionMap[toState]);
  });
};

var Transition = function Transition(fromState, toState, signals) {
  _classCallCheck(this, Transition);

  this.from = fromState;
  this.to = toState;
  this.signals = signals;
}

/**
 * Simple machine representation for estado.
 *
 * {
 *   (String) state : {
 *     (String) toState : (String|String[]) symbol(s)
 *   }
 * }
 * 
 * @param  {Object} transitionGraph Object representing transition graph
 *                                  (as described above)
 * @param  {Array}  finalStates     Array of final states (defaults to [])
 * @return {Machine}                Returns an estado Machine instance.
 */
;

function machine(transitionGraph) {
  var finalStates = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

  var states = getStates(transitionGraph);

  var signals = getSignals(transitionGraph);

  var initialState = states[0];

  return new Machine(signals, states, initialState, dfaTransition, finalStates);
}

function getStates(transitionGraph) {
  return Object.keys(transitionGraph).map(function (stateName) {
    return new State(stateName, transitionGraph[stateName] || {});
  });
}

function getSignals(transitionGraph) {
  var signals = [];

  if (_lodash2['default'].isString(transitionGraph) || _lodash2['default'].isArray(transitionGraph)) {
    signals = Array.prototype.concat([], transitionGraph);
  } else if (_lodash2['default'].isObject(transitionGraph)) {
    signals = _lodash2['default'].values(transitionGraph).map(function (stateValue) {
      return getSignals(stateValue);
    }).reduce(function (a, b) {
      return a.concat(b);
    });
  }

  return _lodash2['default'].unique(signals);
}

function dfaTransition(state, symbol) {
  var transition = state.transitions.find(function (transition) {
    return _lodash2['default'].contains(transition.signals, symbol);
  });

  if (transition) {
    return transition.to;
  }

  console.error('State \'' + state.name + '\' does not have a valid transition for symbol \'' + symbol + '\'');
}