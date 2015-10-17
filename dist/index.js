'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _dfa = require('./dfa');

var _dfa2 = _interopRequireDefault(_dfa);

if (!global._babelPolyfill) {
  require('babel-core/polyfill');
}

exports.machine = _dfa2['default'];