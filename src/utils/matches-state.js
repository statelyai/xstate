import union from 'lodash/array/union';

export default function matchesState(state, superState) {
  if (state === superState) return true;

  if (!state || !superState) return false;

  let [ stateIds, superStateIds ] = [ state, superState ]
    .map((ids) => ids.split('.')
      .map((id, index) => id + index));

  return union(stateIds, superStateIds).length === stateIds.length;
}

