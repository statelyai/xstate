'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _isString = require('lodash/lang/isString');

var _isString2 = _interopRequireDefault(_isString);

var _isPlainObject = require('lodash/lang/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _extend = require('lodash/object/extend');

var _extend2 = _interopRequireDefault(_extend);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Action = function Action(data) {
  _classCallCheck(this, Action);

  if (data instanceof Action || (0, _isPlainObject2.default)(data)) {
    (0, _extend2.default)(this, data);
  }

  if ((0, _isString2.default)(data)) {
    this.type = data;
  }
};

exports.default = Action;