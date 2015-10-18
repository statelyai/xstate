'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _lodashLangIsString = require('lodash/lang/isString');

var _lodashLangIsString2 = _interopRequireDefault(_lodashLangIsString);

var _lodashLangIsPlainObject = require('lodash/lang/isPlainObject');

var _lodashLangIsPlainObject2 = _interopRequireDefault(_lodashLangIsPlainObject);

var Signal = function Signal(data) {
  _classCallCheck(this, Signal);

  if (data instanceof Signal || (0, _lodashLangIsPlainObject2['default'])(data)) {
    Object.assign(this, data);
  }

  if ((0, _lodashLangIsString2['default'])(data)) {
    this.event = data;
    this.payload = null;
  }
};

exports['default'] = Signal;
module.exports = exports['default'];