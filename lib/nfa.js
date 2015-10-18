'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = machine;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _machine = require('./machine');

var _machine2 = _interopRequireDefault(_machine);

function machine(data) {
  return new _machine2['default'](data, {
    deterministic: false
  });
}

module.exports = exports['default'];