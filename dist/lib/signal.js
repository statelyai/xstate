'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var Signal = function Signal(data) {
  _classCallCheck(this, Signal);

  if (data instanceof Signal || _lodash2['default'].isPlainObject(data)) {
    Object.assign(this, data);
  }

  if (_lodash2['default'].isString(data)) {
    this.event = data;
    this.payload = null;
  }
};

exports['default'] = Signal;
module.exports = exports['default'];