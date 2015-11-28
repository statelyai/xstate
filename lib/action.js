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

var _lodashObjectExtend = require('lodash/object/extend');

var _lodashObjectExtend2 = _interopRequireDefault(_lodashObjectExtend);

var Action = function Action(data) {
  _classCallCheck(this, Action);

  if (data instanceof Action || (0, _lodashLangIsPlainObject2['default'])(data)) {
    (0, _lodashObjectExtend2['default'])(this, data);
  }

  if ((0, _lodashLangIsString2['default'])(data)) {
    this.type = data;
  }
};

exports['default'] = Action;
module.exports = exports['default'];