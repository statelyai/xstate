(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Estado"] = factory();
	else
		root["Estado"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.parse = exports.matchesState = exports.mapOnExit = exports.mapOnEntry = exports.mapState = exports.actionFilter = exports.stateReducer = exports.nfaMachine = exports.machine = undefined;

	var _dfa = __webpack_require__(6);

	var _dfa2 = _interopRequireDefault(_dfa);

	var _nfa = __webpack_require__(7);

	var _stateReducer = __webpack_require__(8);

	var _stateReducer2 = _interopRequireDefault(_stateReducer);

	var _actionFilter = __webpack_require__(10);

	var _actionFilter2 = _interopRequireDefault(_actionFilter);

	var _mapState = __webpack_require__(11);

	var _matchesState = __webpack_require__(5);

	var _matchesState2 = _interopRequireDefault(_matchesState);

	var _parser = __webpack_require__(3);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.machine = _dfa2.default;
	exports.nfaMachine = _nfa.machine;
	exports.stateReducer = _stateReducer2.default;
	exports.actionFilter = _actionFilter2.default;
	exports.mapState = _mapState.mapState;
	exports.mapOnEntry = _mapState.mapOnEntry;
	exports.mapOnExit = _mapState.mapOnExit;
	exports.matchesState = _matchesState2.default;
	exports.parse = _parser.parse;

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

	var _defaults = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/object/defaults\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _defaults2 = _interopRequireDefault(_defaults);

	var _curry = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/function/curry\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _curry2 = _interopRequireDefault(_curry);

	var _state = __webpack_require__(4);

	var _state2 = _interopRequireDefault(_state);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

	function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

	var Machine = function (_State) {
	  _inherits(Machine, _State);

	  function Machine(data) {
	    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	    _classCallCheck(this, Machine);

	    var _this = _possibleConstructorReturn(this, (Machine.__proto__ || Object.getPrototypeOf(Machine)).call(this, data));

	    _this.options = (0, _defaults2.default)(options, {
	      deterministic: true
	    });

	    _this.mapStateRefs();
	    return _this;
	  }

	  _createClass(Machine, [{
	    key: 'transition',
	    value: function transition() {
	      var fromState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
	      var action = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

	      var states = _get(Machine.prototype.__proto__ || Object.getPrototypeOf(Machine.prototype), 'transition', this).call(this, fromState, action);

	      if (this.options.deterministic) {
	        return states.length ? states[0] : false;
	      }

	      return states;
	    }
	  }]);

	  return Machine;
	}(_state2.default);

	exports.default = Machine;

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _isString = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/lang/isString\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _isString2 = _interopRequireDefault(_isString);

	var _isPlainObject = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/lang/isPlainObject\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

	var _extend = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/object/extend\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

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

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = function () {
	  "use strict";

	  /*
	   * Generated by PEG.js 0.9.0.
	   *
	   * http://pegjs.org/
	   */

	  function peg$subclass(child, parent) {
	    function ctor() {
	      this.constructor = child;
	    }
	    ctor.prototype = parent.prototype;
	    child.prototype = new ctor();
	  }

	  function peg$SyntaxError(message, expected, found, location) {
	    this.message = message;
	    this.expected = expected;
	    this.found = found;
	    this.location = location;
	    this.name = "SyntaxError";

	    if (typeof Error.captureStackTrace === "function") {
	      Error.captureStackTrace(this, peg$SyntaxError);
	    }
	  }

	  peg$subclass(peg$SyntaxError, Error);

	  function peg$parse(input) {
	    var options = arguments.length > 1 ? arguments[1] : {},
	        parser = this,
	        peg$FAILED = {},
	        peg$startRuleFunctions = { Machine: peg$parseMachine },
	        peg$startRuleFunction = peg$parseMachine,
	        peg$c0 = function peg$c0(states) {
	      if (states.length) {
	        states[0].initial = true;
	      }

	      return new Machine({ states: states });
	    },
	        peg$c1 = "{",
	        peg$c2 = { type: "literal", value: "{", description: "\"{\"" },
	        peg$c3 = "}",
	        peg$c4 = { type: "literal", value: "}", description: "\"}\"" },
	        peg$c5 = function peg$c5(states) {
	      if (states.length) {
	        states[0].initial = true;
	      }

	      return states;
	    },
	        peg$c6 = function peg$c6(id, final, states, transitions) {
	      return {
	        id: id,
	        final: !!final,
	        states: states || [],
	        transitions: transitions.map(function (t) {
	          return {
	            target: t.target === true ? id : t.target,
	            event: t.event
	          };
	        })
	      };
	    },
	        peg$c7 = function peg$c7(id) {
	      return id.join('');
	    },
	        peg$c8 = ".",
	        peg$c9 = { type: "literal", value: ".", description: "\".\"" },
	        peg$c10 = function peg$c10(target, subTarget) {
	      return [target, (subTarget || []).join('')].join('');
	    },
	        peg$c11 = "->",
	        peg$c12 = { type: "literal", value: "->", description: "\"->\"" },
	        peg$c13 = function peg$c13(target, event) {
	      return { target: target, event: event };
	    },
	        peg$c14 = "<-",
	        peg$c15 = { type: "literal", value: "<-", description: "\"<-\"" },
	        peg$c16 = function peg$c16(event) {
	      return { target: true, event: event };
	    },
	        peg$c17 = "(",
	        peg$c18 = { type: "literal", value: "(", description: "\"(\"" },
	        peg$c19 = ")",
	        peg$c20 = { type: "literal", value: ")", description: "\")\"" },
	        peg$c21 = function peg$c21(type) {
	      return type;
	    },
	        peg$c22 = "!",
	        peg$c23 = { type: "literal", value: "!", description: "\"!\"" },
	        peg$c24 = function peg$c24(final) {
	      return !!final;
	    },
	        peg$c25 = /^[ \n\t]/,
	        peg$c26 = { type: "class", value: "[ \\n\\t]", description: "[ \\n\\t]" },
	        peg$c27 = /^[a-z0-9_]/i,
	        peg$c28 = { type: "class", value: "[a-z0-9\\_]i", description: "[a-z0-9\\_]i" },
	        peg$c29 = function peg$c29(id) {
	      return id.join('');
	    },
	        peg$currPos = 0,
	        peg$savedPos = 0,
	        peg$posDetailsCache = [{ line: 1, column: 1, seenCR: false }],
	        peg$maxFailPos = 0,
	        peg$maxFailExpected = [],
	        peg$silentFails = 0,
	        peg$result;

	    if ("startRule" in options) {
	      if (!(options.startRule in peg$startRuleFunctions)) {
	        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
	      }

	      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
	    }

	    function text() {
	      return input.substring(peg$savedPos, peg$currPos);
	    }

	    function location() {
	      return peg$computeLocation(peg$savedPos, peg$currPos);
	    }

	    function expected(description) {
	      throw peg$buildException(null, [{ type: "other", description: description }], input.substring(peg$savedPos, peg$currPos), peg$computeLocation(peg$savedPos, peg$currPos));
	    }

	    function error(message) {
	      throw peg$buildException(message, null, input.substring(peg$savedPos, peg$currPos), peg$computeLocation(peg$savedPos, peg$currPos));
	    }

	    function peg$computePosDetails(pos) {
	      var details = peg$posDetailsCache[pos],
	          p,
	          ch;

	      if (details) {
	        return details;
	      } else {
	        p = pos - 1;
	        while (!peg$posDetailsCache[p]) {
	          p--;
	        }

	        details = peg$posDetailsCache[p];
	        details = {
	          line: details.line,
	          column: details.column,
	          seenCR: details.seenCR
	        };

	        while (p < pos) {
	          ch = input.charAt(p);
	          if (ch === "\n") {
	            if (!details.seenCR) {
	              details.line++;
	            }
	            details.column = 1;
	            details.seenCR = false;
	          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
	            details.line++;
	            details.column = 1;
	            details.seenCR = true;
	          } else {
	            details.column++;
	            details.seenCR = false;
	          }

	          p++;
	        }

	        peg$posDetailsCache[pos] = details;
	        return details;
	      }
	    }

	    function peg$computeLocation(startPos, endPos) {
	      var startPosDetails = peg$computePosDetails(startPos),
	          endPosDetails = peg$computePosDetails(endPos);

	      return {
	        start: {
	          offset: startPos,
	          line: startPosDetails.line,
	          column: startPosDetails.column
	        },
	        end: {
	          offset: endPos,
	          line: endPosDetails.line,
	          column: endPosDetails.column
	        }
	      };
	    }

	    function peg$fail(expected) {
	      if (peg$currPos < peg$maxFailPos) {
	        return;
	      }

	      if (peg$currPos > peg$maxFailPos) {
	        peg$maxFailPos = peg$currPos;
	        peg$maxFailExpected = [];
	      }

	      peg$maxFailExpected.push(expected);
	    }

	    function peg$buildException(message, expected, found, location) {
	      function cleanupExpected(expected) {
	        var i = 1;

	        expected.sort(function (a, b) {
	          if (a.description < b.description) {
	            return -1;
	          } else if (a.description > b.description) {
	            return 1;
	          } else {
	            return 0;
	          }
	        });

	        while (i < expected.length) {
	          if (expected[i - 1] === expected[i]) {
	            expected.splice(i, 1);
	          } else {
	            i++;
	          }
	        }
	      }

	      function buildMessage(expected, found) {
	        function stringEscape(s) {
	          function hex(ch) {
	            return ch.charCodeAt(0).toString(16).toUpperCase();
	          }

	          return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\x08/g, '\\b').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\f/g, '\\f').replace(/\r/g, '\\r').replace(/[\x00-\x07\x0B\x0E\x0F]/g, function (ch) {
	            return '\\x0' + hex(ch);
	          }).replace(/[\x10-\x1F\x80-\xFF]/g, function (ch) {
	            return '\\x' + hex(ch);
	          }).replace(/[\u0100-\u0FFF]/g, function (ch) {
	            return "\\u0" + hex(ch);
	          }).replace(/[\u1000-\uFFFF]/g, function (ch) {
	            return "\\u" + hex(ch);
	          });
	        }

	        var expectedDescs = new Array(expected.length),
	            expectedDesc,
	            foundDesc,
	            i;

	        for (i = 0; i < expected.length; i++) {
	          expectedDescs[i] = expected[i].description;
	        }

	        expectedDesc = expected.length > 1 ? expectedDescs.slice(0, -1).join(", ") + " or " + expectedDescs[expected.length - 1] : expectedDescs[0];

	        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

	        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
	      }

	      if (expected !== null) {
	        cleanupExpected(expected);
	      }

	      return new peg$SyntaxError(message !== null ? message : buildMessage(expected, found), expected, found, location);
	    }

	    function peg$parseMachine() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parseState();
	      while (s2 !== peg$FAILED) {
	        s1.push(s2);
	        s2 = peg$parseState();
	      }
	      if (s1 !== peg$FAILED) {
	        peg$savedPos = s0;
	        s1 = peg$c0(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parseStates() {
	      var s0, s1, s2, s3, s4, s5, s6;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parsews();
	      while (s2 !== peg$FAILED) {
	        s1.push(s2);
	        s2 = peg$parsews();
	      }
	      if (s1 !== peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 123) {
	          s2 = peg$c1;
	          peg$currPos++;
	        } else {
	          s2 = peg$FAILED;
	          if (peg$silentFails === 0) {
	            peg$fail(peg$c2);
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          s3 = [];
	          s4 = peg$parseState();
	          while (s4 !== peg$FAILED) {
	            s3.push(s4);
	            s4 = peg$parseState();
	          }
	          if (s3 !== peg$FAILED) {
	            if (input.charCodeAt(peg$currPos) === 125) {
	              s4 = peg$c3;
	              peg$currPos++;
	            } else {
	              s4 = peg$FAILED;
	              if (peg$silentFails === 0) {
	                peg$fail(peg$c4);
	              }
	            }
	            if (s4 !== peg$FAILED) {
	              s5 = [];
	              s6 = peg$parsews();
	              while (s6 !== peg$FAILED) {
	                s5.push(s6);
	                s6 = peg$parsews();
	              }
	              if (s5 !== peg$FAILED) {
	                peg$savedPos = s0;
	                s1 = peg$c5(s3);
	                s0 = s1;
	              } else {
	                peg$currPos = s0;
	                s0 = peg$FAILED;
	              }
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }

	      return s0;
	    }

	    function peg$parseState() {
	      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parsews();
	      while (s2 !== peg$FAILED) {
	        s1.push(s2);
	        s2 = peg$parsews();
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parseStateId();
	        if (s2 !== peg$FAILED) {
	          s3 = [];
	          s4 = peg$parsews();
	          while (s4 !== peg$FAILED) {
	            s3.push(s4);
	            s4 = peg$parsews();
	          }
	          if (s3 !== peg$FAILED) {
	            s4 = peg$parseFinalToken();
	            if (s4 === peg$FAILED) {
	              s4 = null;
	            }
	            if (s4 !== peg$FAILED) {
	              s5 = [];
	              s6 = peg$parsews();
	              while (s6 !== peg$FAILED) {
	                s5.push(s6);
	                s6 = peg$parsews();
	              }
	              if (s5 !== peg$FAILED) {
	                s6 = peg$parseStates();
	                if (s6 === peg$FAILED) {
	                  s6 = null;
	                }
	                if (s6 !== peg$FAILED) {
	                  s7 = [];
	                  s8 = peg$parsews();
	                  while (s8 !== peg$FAILED) {
	                    s7.push(s8);
	                    s8 = peg$parsews();
	                  }
	                  if (s7 !== peg$FAILED) {
	                    s8 = [];
	                    s9 = peg$parseTransition();
	                    while (s9 !== peg$FAILED) {
	                      s8.push(s9);
	                      s9 = peg$parseTransition();
	                    }
	                    if (s8 !== peg$FAILED) {
	                      s9 = [];
	                      s10 = peg$parsews();
	                      while (s10 !== peg$FAILED) {
	                        s9.push(s10);
	                        s10 = peg$parsews();
	                      }
	                      if (s9 !== peg$FAILED) {
	                        peg$savedPos = s0;
	                        s1 = peg$c6(s2, s4, s6, s8);
	                        s0 = s1;
	                      } else {
	                        peg$currPos = s0;
	                        s0 = peg$FAILED;
	                      }
	                    } else {
	                      peg$currPos = s0;
	                      s0 = peg$FAILED;
	                    }
	                  } else {
	                    peg$currPos = s0;
	                    s0 = peg$FAILED;
	                  }
	                } else {
	                  peg$currPos = s0;
	                  s0 = peg$FAILED;
	                }
	              } else {
	                peg$currPos = s0;
	                s0 = peg$FAILED;
	              }
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }

	      return s0;
	    }

	    function peg$parseStateId() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parseidentifier();
	      if (s2 !== peg$FAILED) {
	        while (s2 !== peg$FAILED) {
	          s1.push(s2);
	          s2 = peg$parseidentifier();
	        }
	      } else {
	        s1 = peg$FAILED;
	      }
	      if (s1 !== peg$FAILED) {
	        peg$savedPos = s0;
	        s1 = peg$c7(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parseTargetId() {
	      var s0, s1, s2, s3, s4;

	      s0 = peg$currPos;
	      s1 = peg$parseStateId();
	      if (s1 !== peg$FAILED) {
	        s2 = peg$currPos;
	        if (input.charCodeAt(peg$currPos) === 46) {
	          s3 = peg$c8;
	          peg$currPos++;
	        } else {
	          s3 = peg$FAILED;
	          if (peg$silentFails === 0) {
	            peg$fail(peg$c9);
	          }
	        }
	        if (s3 !== peg$FAILED) {
	          s4 = peg$parseTargetId();
	          if (s4 !== peg$FAILED) {
	            s3 = [s3, s4];
	            s2 = s3;
	          } else {
	            peg$currPos = s2;
	            s2 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s2;
	          s2 = peg$FAILED;
	        }
	        if (s2 === peg$FAILED) {
	          s2 = null;
	        }
	        if (s2 !== peg$FAILED) {
	          peg$savedPos = s0;
	          s1 = peg$c10(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }

	      return s0;
	    }

	    function peg$parseTransition() {
	      var s0, s1, s2, s3, s4;

	      s0 = peg$currPos;
	      if (input.substr(peg$currPos, 2) === peg$c11) {
	        s1 = peg$c11;
	        peg$currPos += 2;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) {
	          peg$fail(peg$c12);
	        }
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$parsews();
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$parsews();
	        }
	        if (s2 !== peg$FAILED) {
	          s3 = peg$parseTargetId();
	          if (s3 !== peg$FAILED) {
	            s4 = peg$parseAction();
	            if (s4 === peg$FAILED) {
	              s4 = null;
	            }
	            if (s4 !== peg$FAILED) {
	              peg$savedPos = s0;
	              s1 = peg$c13(s3, s4);
	              s0 = s1;
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }
	      if (s0 === peg$FAILED) {
	        s0 = peg$currPos;
	        if (input.substr(peg$currPos, 2) === peg$c14) {
	          s1 = peg$c14;
	          peg$currPos += 2;
	        } else {
	          s1 = peg$FAILED;
	          if (peg$silentFails === 0) {
	            peg$fail(peg$c15);
	          }
	        }
	        if (s1 !== peg$FAILED) {
	          s2 = [];
	          s3 = peg$parsews();
	          while (s3 !== peg$FAILED) {
	            s2.push(s3);
	            s3 = peg$parsews();
	          }
	          if (s2 !== peg$FAILED) {
	            s3 = peg$parseAction();
	            if (s3 === peg$FAILED) {
	              s3 = null;
	            }
	            if (s3 !== peg$FAILED) {
	              peg$savedPos = s0;
	              s1 = peg$c16(s3);
	              s0 = s1;
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      }

	      return s0;
	    }

	    function peg$parseAction() {
	      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

	      s0 = peg$currPos;
	      s1 = [];
	      s2 = peg$parsews();
	      while (s2 !== peg$FAILED) {
	        s1.push(s2);
	        s2 = peg$parsews();
	      }
	      if (s1 !== peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 40) {
	          s2 = peg$c17;
	          peg$currPos++;
	        } else {
	          s2 = peg$FAILED;
	          if (peg$silentFails === 0) {
	            peg$fail(peg$c18);
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          s3 = [];
	          s4 = peg$parsews();
	          while (s4 !== peg$FAILED) {
	            s3.push(s4);
	            s4 = peg$parsews();
	          }
	          if (s3 !== peg$FAILED) {
	            s4 = peg$parseidentifier();
	            if (s4 !== peg$FAILED) {
	              s5 = [];
	              s6 = peg$parsews();
	              while (s6 !== peg$FAILED) {
	                s5.push(s6);
	                s6 = peg$parsews();
	              }
	              if (s5 !== peg$FAILED) {
	                if (input.charCodeAt(peg$currPos) === 41) {
	                  s6 = peg$c19;
	                  peg$currPos++;
	                } else {
	                  s6 = peg$FAILED;
	                  if (peg$silentFails === 0) {
	                    peg$fail(peg$c20);
	                  }
	                }
	                if (s6 !== peg$FAILED) {
	                  s7 = [];
	                  s8 = peg$parsews();
	                  while (s8 !== peg$FAILED) {
	                    s7.push(s8);
	                    s8 = peg$parsews();
	                  }
	                  if (s7 !== peg$FAILED) {
	                    peg$savedPos = s0;
	                    s1 = peg$c21(s4);
	                    s0 = s1;
	                  } else {
	                    peg$currPos = s0;
	                    s0 = peg$FAILED;
	                  }
	                } else {
	                  peg$currPos = s0;
	                  s0 = peg$FAILED;
	                }
	              } else {
	                peg$currPos = s0;
	                s0 = peg$FAILED;
	              }
	            } else {
	              peg$currPos = s0;
	              s0 = peg$FAILED;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$FAILED;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$FAILED;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$FAILED;
	      }

	      return s0;
	    }

	    function peg$parseFinalToken() {
	      var s0, s1;

	      s0 = peg$currPos;
	      if (input.charCodeAt(peg$currPos) === 33) {
	        s1 = peg$c22;
	        peg$currPos++;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) {
	          peg$fail(peg$c23);
	        }
	      }
	      if (s1 !== peg$FAILED) {
	        peg$savedPos = s0;
	        s1 = peg$c24(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parsews() {
	      var s0;

	      if (peg$c25.test(input.charAt(peg$currPos))) {
	        s0 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) {
	          peg$fail(peg$c26);
	        }
	      }

	      return s0;
	    }

	    function peg$parseidentifier() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = [];
	      if (peg$c27.test(input.charAt(peg$currPos))) {
	        s2 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s2 = peg$FAILED;
	        if (peg$silentFails === 0) {
	          peg$fail(peg$c28);
	        }
	      }
	      if (s2 !== peg$FAILED) {
	        while (s2 !== peg$FAILED) {
	          s1.push(s2);
	          if (peg$c27.test(input.charAt(peg$currPos))) {
	            s2 = input.charAt(peg$currPos);
	            peg$currPos++;
	          } else {
	            s2 = peg$FAILED;
	            if (peg$silentFails === 0) {
	              peg$fail(peg$c28);
	            }
	          }
	        }
	      } else {
	        s1 = peg$FAILED;
	      }
	      if (s1 !== peg$FAILED) {
	        peg$savedPos = s0;
	        s1 = peg$c29(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    var State = __webpack_require__(4);
	    var Machine = __webpack_require__(1);

	    peg$result = peg$startRuleFunction();

	    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
	      return peg$result;
	    } else {
	      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
	        peg$fail({ type: "end", description: "end of input" });
	      }

	      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null, peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos));
	    }
	  }

	  return {
	    SyntaxError: peg$SyntaxError,
	    parse: peg$parse
	  };
	}();

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	var _transition = __webpack_require__(9);

	var _transition2 = _interopRequireDefault(_transition);

	var _difference = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/array/difference\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _difference2 = _interopRequireDefault(_difference);

	var _unique = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/array/unique\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _unique2 = _interopRequireDefault(_unique);

	var _isArray = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/lang/isArray\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _isArray2 = _interopRequireDefault(_isArray);

	var _isString = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/lang/isString\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _isString2 = _interopRequireDefault(_isString);

	var _find = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/collection/find\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _find2 = _interopRequireDefault(_find);

	var _parser = __webpack_require__(3);

	var _action = __webpack_require__(2);

	var _action2 = _interopRequireDefault(_action);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var STATE_DELIMITER = '.';

	var State = function () {
	  function State(data) {
	    var _this = this;

	    var parent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

	    _classCallCheck(this, State);

	    data = (0, _isString2.default)(data) ? (0, _parser.parse)(data) : data;

	    this.id = data.id || 'root';

	    this._id = parent ? parent._id.concat(this.id) : [this.id];

	    this.states = data.states ? data.states.map(function (state) {
	      return new State(state, _this);
	    }) : [];

	    this.transitions = data.transitions ? data.transitions.map(function (transition) {
	      return new _transition2.default(transition);
	    }) : [];

	    this.alphabet = this.getAlphabet();

	    this.initial = !!data.initial;

	    this.final = !!data.final;
	  }

	  _createClass(State, [{
	    key: 'mapStateRefs',
	    value: function mapStateRefs() {
	      var _this2 = this;

	      this.states = this.states.map(function (state) {
	        state.transitions = state.transitions.map(function (transition) {
	          transition.targetState = _this2.getState(transition.target);

	          return Object.freeze(transition);
	        });

	        return state.mapStateRefs();
	      });

	      return Object.freeze(this);
	    }
	  }, {
	    key: 'relativeId',
	    value: function relativeId() {
	      var fromState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

	      return (0, _difference2.default)(this._id, fromState._id).join('.');
	    }
	  }, {
	    key: 'transition',
	    value: function transition() {
	      var fromState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

	      var _this3 = this;

	      var action = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
	      var returnFlag = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

	      var substateIds = this.getSubstateIds(fromState);
	      var initialStates = this.states.filter(function (state) {
	        return state.initial;
	      });
	      var nextStates = [];
	      var currentSubstate = substateIds.length ? this.getState(substateIds[0]) : null;

	      if (substateIds.length) {
	        if (!currentSubstate) {
	          return [];
	        }

	        nextStates = currentSubstate.transition(substateIds.slice(1), action, false);

	        if (!nextStates.length) {
	          nextStates = this.transitions.filter(function (transition) {
	            return transition.isValid(action);
	          }).map(function (transition) {
	            return transition.targetState.initialStates();
	          }).reduce(function (a, b) {
	            return a.concat(b);
	          }, []);
	        }
	      } else if (initialStates.length) {
	        nextStates = initialStates.map(function (state) {
	          return state.transition(null, action, false);
	        }).reduce(function (a, b) {
	          return a.concat(b);
	        }, []);
	      } else if (action) {
	        nextStates = this.transitions.filter(function (transition) {
	          return transition.isValid(action);
	        }).map(function (transition) {
	          return transition.targetState.initialStates();
	        }).reduce(function (a, b) {
	          return a.concat(b);
	        }, []);
	      } else {
	        nextStates = this.initialStates();
	      }

	      return returnFlag ? nextStates.map(function (state) {
	        return state.relativeId(_this3);
	      }) : nextStates;
	    }
	  }, {
	    key: 'initialStates',
	    value: function initialStates() {
	      var _initialStates = this.states.filter(function (state) {
	        return state.initial;
	      });

	      return _initialStates.length ? _initialStates.map(function (state) {
	        return state.initialStates();
	      }).reduce(function (a, b) {
	        return a.concat(b);
	      }, []) : [this];
	    }
	  }, {
	    key: 'getSubstateIds',
	    value: function getSubstateIds(fromState) {
	      if (!fromState) return [];

	      if (fromState instanceof State) {
	        return fromState._id;
	      }

	      fromState = fromState || [];

	      return (0, _isArray2.default)(fromState) ? fromState : (0, _isString2.default)(fromState) ? fromState.split(STATE_DELIMITER) : false;
	    }
	  }, {
	    key: 'getState',
	    value: function getState(substates) {
	      if (substates instanceof State) {
	        return substates;
	      }

	      substates = this.getSubstateIds(substates);

	      if (!substates.length) {
	        return this;
	      }

	      var substate = (0, _find2.default)(this.states, function (state) {
	        return state.id === substates[0];
	      });

	      return substate ? substates.length > 1 ? substate.getState(substates.slice(1)) : substate : false;
	    }
	  }, {
	    key: 'getAlphabet',
	    value: function getAlphabet() {
	      return this.alphabet || (0, _unique2.default)(this.states.map(function (state) {
	        return state.getAlphabet();
	      }).concat(this.transitions.map(function (transition) {
	        return transition.event;
	      })).reduce(function (a, b) {
	        return a.concat(b);
	      }, []));
	    }
	  }, {
	    key: 'isValidAction',
	    value: function isValidAction(action) {
	      if (!action) return false;

	      var actionType = new _action2.default(action).type;

	      return this.getAlphabet().indexOf(actionType) !== -1;
	    }
	  }]);

	  return State;
	}();

	exports.default = State;

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

	exports.default = matchesState;

	var _union = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/array/union\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _union2 = _interopRequireDefault(_union);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function matchesState(state, superState) {
	  if (state === superState) return true;

	  if (!state || !superState) return false;

	  var _map = [state, superState].map(function (ids) {
	    return ids.split('.').map(function (id, index) {
	      return id + index;
	    });
	  }),
	      _map2 = _slicedToArray(_map, 2),
	      stateIds = _map2[0],
	      superStateIds = _map2[1];

	  return (0, _union2.default)(stateIds, superStateIds).length === stateIds.length;
	}

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = machine;

	var _machine = __webpack_require__(1);

	var _machine2 = _interopRequireDefault(_machine);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function machine(data) {
	  return new _machine2.default(data, {
	    deterministic: true
	  });
	}

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = machine;

	var _machine = __webpack_require__(1);

	var _machine2 = _interopRequireDefault(_machine);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function machine(data) {
	  return new _machine2.default(data, {
	    deterministic: false
	  });
	}

/***/ },
/* 8 */
/***/ function(module, exports) {

	"use strict";

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});


	function stateReducer(machine) {
	  var initialState = machine.transition();

	  return function () {
	    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : initialState;
	    var action = arguments[1];

	    if (!action || !machine.isValidAction(action)) {
	      return state;
	    }

	    return machine.transition(state, action);
	  };
	}

	exports.default = stateReducer;

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	var _action = __webpack_require__(2);

	var _action2 = _interopRequireDefault(_action);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	function alwaysTrue() {
	  return true;
	}

	var Transition = function () {
	  function Transition(data, fromState) {
	    _classCallCheck(this, Transition);

	    this.event = data.event;

	    this.target = data.target;

	    this.cond = data.cond || alwaysTrue;
	  }

	  _createClass(Transition, [{
	    key: 'isValid',
	    value: function isValid(action) {
	      action = new _action2.default(action);

	      return action.type === this.event && !!this.cond(action);
	    }
	  }]);

	  return Transition;
	}();

	exports.default = Transition;

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _curry = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/function/curry\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _curry2 = _interopRequireDefault(_curry);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function actionFilter() {
	  var filter = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {
	    return true;
	  };
	  var stateReducer = arguments[1];

	  return function (state, action) {
	    if (!state) {
	      return stateReducer();
	    }

	    if (!filter(action)) {
	      return state;
	    }

	    return stateReducer(state, action);
	  };
	}

	exports.default = (0, _curry2.default)(actionFilter);

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.mapOnExit = exports.mapOnEntry = exports.mapState = undefined;

	var _matchesState = __webpack_require__(5);

	var _matchesState2 = _interopRequireDefault(_matchesState);

	var _find = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/collection/find\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _find2 = _interopRequireDefault(_find);

	var _filter = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/collection/filter\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _filter2 = _interopRequireDefault(_filter);

	var _max = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/collection/max\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _max2 = _interopRequireDefault(_max);

	var _curry = __webpack_require__(!(function webpackMissingModule() { var e = new Error("Cannot find module \"lodash/function/curry\""); e.code = 'MODULE_NOT_FOUND'; throw e; }()));

	var _curry2 = _interopRequireDefault(_curry);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	var getMatchingStateId = function getMatchingStateId(stateMap, state) {
	  var result = Object.keys(stateMap).filter(function (stateId) {
	    return (0, _matchesState2.default)(state, stateId);
	  });

	  if (result.length) {
	    return (0, _max2.default)(result, function (s) {
	      return s.length;
	    });
	  }

	  return null;
	};

	var mapState = (0, _curry2.default)(function (stateMap, state) {
	  var matchingStateId = getMatchingStateId(stateMap, state);

	  if (!matchingStateId) return null;

	  return stateMap[matchingStateId];
	});

	var mapOnEntry = (0, _curry2.default)(function (stateMap, state) {
	  var prevState = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

	  // If state hasn't changed, don't do anything
	  if ((0, _matchesState2.default)(prevState, state)) {
	    return null;
	  }

	  var matchingStateId = getMatchingStateId(stateMap, state);

	  if (matchingStateId !== state) {
	    return mapOnEntry(stateMap, matchingStateId, prevState);
	  }

	  return stateMap[matchingStateId];
	});

	var mapOnExit = (0, _curry2.default)(function (stateMap, state) {
	  var prevState = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

	  // If state hasn't changed, don't do anything
	  if ((0, _matchesState2.default)(state, prevState)) {
	    return null;
	  }

	  var matchingStateId = getMatchingStateId(stateMap, prevState);

	  if (matchingStateId !== prevState) {
	    return mapOnExit(stateMap, state, matchingStateId);
	  }

	  return stateMap[matchingStateId];
	});

	exports.mapState = mapState;
	exports.mapOnEntry = mapOnEntry;
	exports.mapOnExit = mapOnExit;

/***/ }
/******/ ])
});
;