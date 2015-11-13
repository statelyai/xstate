'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _matchesState = require('./matches-state');

var _matchesState2 = _interopRequireDefault(_matchesState);

function transitionMap(machine, selectedState) {
  var result = {};

  var activeState = machine.transition(selectedState, 'T');

  console.log(activeState);

  machine.states.map(function (state) {
    result[state.id] = (0, _matchesState2['default'])(activeState, state.id) ? state.states.length ? transitionMap(state, activeState) : true : false;
  });

  return result;
}

exports['default'] = transitionMap;
module.exports = exports['default'];