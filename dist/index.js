'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = machine;
exports.transition = transition;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _libMachine = require('./lib/machine');

var _libMachine2 = _interopRequireDefault(_libMachine);

if (!global._babelPolyfill) {
  require('babel-core/polyfill');
}

function machine(data) {
  return new _libMachine2['default'](data);
}

function transition(machine) {
  var fromState = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];
  var signal = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

  var states = machine.transition(fromState, signal);

  console.log('HERE');

  return states.map(function (state) {
    console.log(state);
    return state.relativeId(fromState);
  });
}

;