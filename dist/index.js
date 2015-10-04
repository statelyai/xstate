'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = machine;

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

module.exports = exports['default'];