'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mapOnExit = exports.mapOnEntry = exports.mapState = undefined;

var _matchesState = require('./matches-state');

var _matchesState2 = _interopRequireDefault(_matchesState);

var _find = require('lodash/collection/find');

var _find2 = _interopRequireDefault(_find);

var _filter = require('lodash/collection/filter');

var _filter2 = _interopRequireDefault(_filter);

var _max = require('lodash/collection/max');

var _max2 = _interopRequireDefault(_max);

var _curry = require('lodash/function/curry');

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