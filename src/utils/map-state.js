import matchesState from './matches-state';
import find from 'lodash/collection/find';
import filter from 'lodash/collection/filter';
import max from 'lodash/collection/max';
import curry from 'lodash/function/curry';

const mapState = curry((stateMap, state) => {
  let result = Object.keys(stateMap)
    .filter((stateId) => matchesState(state, stateId));

  if (result.length) {
    return stateMap[ max(result, (s) => s.length) ];
  }

  return null;
});

const mapOnEntry = curry((stateMap, state, prevState = null) => {
  // If state hasn't changed, don't do anything
  if (matchesState(prevState, state)) {
    return null;
  }

  return mapState(stateMap, state);
});

const mapOnExit = curry((stateMap, state, prevState = null) => {
  // If state hasn't changed, don't do anything
  if (prevState === state) {
    return null;
  }

  return mapState(stateMap, prevState);
});

export {
  mapState,
  mapOnEntry,
  mapOnExit
}