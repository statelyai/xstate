'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

require('babel-core/polyfill');

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var Machine = (function () {
  function Machine(symbols, states, initialState, transitionFn) {
    var finalStates = arguments.length <= 4 || arguments[4] === undefined ? [] : arguments[4];

    _classCallCheck(this, Machine);

    this.symbols = symbols;
    this.states = states;
    this.initialState = initialState;
    this.transitionFn = transitionFn;
    this.finalStates = finalStates;
  }

  _createClass(Machine, [{
    key: 'transition',
    value: function transition(state) {
      var symbol = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      return this.transitionFn(state, symbol);
    }
  }]);

  return Machine;
})();

function machine(transitionGraph) {

  var states = new Set(Object.keys(transitionGraph).map(function (state) {
    return [state].concat(Object.keys(transitionGraph[state]));
  }).reduce(function (a, b) {
    return a.concat(b);
  }));

  var symbols = new Set(Object.keys(transitionGraph).map(function (state) {
    return Object.values(transitionGraph[state]);
  }).reduce(function (a, b) {
    return a.concat(b);
  }));
}

function dfaTransition(transitionGraph, state, symbol) {
  var stateGraph = transitionGraph[state];

  return Object.keys(stateGraph).find(function (toState) {
    return stateGraph[toState] === symbol;
  });
}

console.log(machine({
  red: {
    green: 'timer',
    blink: 'bang'
  },
  yellow: {
    red: 'timer',
    blink: 'bang'
  }
}));