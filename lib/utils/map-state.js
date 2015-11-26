'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _matchesState = require('./matches-state');

var _matchesState2 = _interopRequireDefault(_matchesState);

var _lodashCollectionFind = require('lodash/collection/find');

var _lodashCollectionFind2 = _interopRequireDefault(_lodashCollectionFind);

var _lodashCollectionFilter = require('lodash/collection/filter');

var _lodashCollectionFilter2 = _interopRequireDefault(_lodashCollectionFilter);

var _lodashCollectionMax = require('lodash/collection/max');

var _lodashCollectionMax2 = _interopRequireDefault(_lodashCollectionMax);

var _lodashFunctionCurry = require('lodash/function/curry');

var _lodashFunctionCurry2 = _interopRequireDefault(_lodashFunctionCurry);

var mapState = (0, _lodashFunctionCurry2['default'])(function (stateMap, state) {
  var result = Object.keys(stateMap).filter(function (stateId) {
    return (0, _matchesState2['default'])(state, stateId);
  });

  if (result.length) {
    return stateMap[(0, _lodashCollectionMax2['default'])(result, function (s) {
      return s.length;
    })];
  }

  return null;
});

var mapOnEntry = (0, _lodashFunctionCurry2['default'])(function (stateMap, state) {
  var prevState = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

  // If state hasn't changed, don't do anything
  if ((0, _matchesState2['default'])(prevState, state)) {
    return null;
  }

  return mapState(stateMap, state);
});

var mapOnExit = (0, _lodashFunctionCurry2['default'])(function (stateMap, state) {
  var prevState = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

  // If state hasn't changed, don't do anything
  if (prevState === state) {
    return null;
  }

  return mapState(stateMap, prevState);
});

exports.mapState = mapState;
exports.mapOnEntry = mapOnEntry;
exports.mapOnExit = mapOnExit;