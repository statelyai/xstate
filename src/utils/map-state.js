import matchesState from './matches-state';
import find from 'lodash/collection/find';
import filter from 'lodash/collection/filter';
import max from 'lodash/collection/max';
import curry from 'lodash/function/curry';

function mapState(stateMap, state) {
  let result = Object.keys(stateMap)
    .filter((stateId) => matchesState(state, stateId));

  if (result.length) {
    return stateMap[ max(result, (s) => s.length) ];
  }

  return null;
}

export default curry(mapState);