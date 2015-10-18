'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = machine;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _libMachine = require('./lib/machine');

var _libMachine2 = _interopRequireDefault(_libMachine);

function machine(data) {
  return new _libMachine2['default'](data, {
    deterministic: false
  });
}

module.exports = exports['default'];