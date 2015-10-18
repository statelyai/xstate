'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _dfa = require('./dfa');

var _dfa2 = _interopRequireDefault(_dfa);

var _nfa = require('./nfa');

var _stateReducer = require('./state-reducer');

var _stateReducer2 = _interopRequireDefault(_stateReducer);

exports.machine = _dfa2['default'];
exports.nfaMachine = _nfa.machine;
exports.stateReducer = _stateReducer2['default'];