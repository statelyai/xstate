import union from 'lodash/array/union';

export default function matchesState(state, superState) {
  if (state === superState) return true;

  if (!state || !superState) return false;

  let [ stateIds, superStateIds ] = [ state, superState ]
    .map((id) => id.split('.'));

  return union(stateIds, superStateIds).length === stateIds.length;
}

