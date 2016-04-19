'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = machine;

var _machine = require('./machine');

var _machine2 = _interopRequireDefault(_machine);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function machine(data) {
  return new _machine2.default(data, {
    deterministic: false
  });
}