import { matchesState } from './utils';

export function mapState(
  stateMap: { [stateId: string]: any },
  stateId: string
) {
  let foundStateId;

  for (const mappedStateId of Object.keys(stateMap)) {
    if (
      matchesState(mappedStateId, stateId) &&
      (!foundStateId || stateId.length > foundStateId.length)
    ) {
      foundStateId = mappedStateId;
    }
  }

  return stateMap[foundStateId];
}
