import matchesState from './matches-state';
import find from 'lodash/collection/find';
import filter from 'lodash/collection/filter';
import max from 'lodash/collection/max';
import curry from 'lodash/function/curry';

const getMatchingStateId = (stateMap, state) => {
  let result = Object.keys(stateMap)
    .filter((stateId) => matchesState(state, stateId));

  if (result.length) {
    return max(result, (s) => s.length);
  }

  return null;
}

const mapState = curry((stateMap, state) => {
  let matchingStateId = getMatchingStateId(stateMap, state);

  if (!matchingStateId) return null;

  return stateMap[ matchingStateId ];
});

const mapOnEntry = curry((stateMap, state, prevState = null) => {
  // If state hasn't changed, don't do anything
  if (matchesState(prevState, state)) {
    return null;
  }

  let matchingStateId = getMatchingStateId(stateMap, state);

  if (matchingStateId !== state) {
    return mapOnEntry(stateMap, matchingStateId, prevState);
  }

  return stateMap[ matchingStateId ];
});

const mapOnExit = curry((stateMap, state, prevState = null) => {
  // If state hasn't changed, don't do anything
  if (matchesState(state, prevState)) {
    return null;
  }

  let matchingStateId = getMatchingStateId(stateMap, prevState);

  if (matchingStateId !== prevState) {
    return mapOnExit(stateMap, state, matchingStateId);
  }

  return stateMap[ matchingStateId ];
});

export {
  mapState,
  mapOnEntry,
  mapOnExit
}