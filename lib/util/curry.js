"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _slice = Array.prototype.slice;
exports["default"] = curry;

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function curry(fn) {
  var arity = fn.length;

  return function f1() {
    var _arguments = arguments;

    var args = [].concat(_slice.call(arguments));

    if (args.length >= arity) {
      return fn.apply(null, args);
    } else {
      return function () {
        return f1.apply(null, [].concat(_toConsumableArray(args), _slice.call(_arguments)));
      };
    }
  };
}

module.exports = exports["default"];