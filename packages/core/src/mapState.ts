import { matchesState } from './utils.ts';

export function mapState(
  stateMap: { [stateId: string]: any },
  stateId: string
) {
  let foundStateId: string | undefined;

  for (const mappedStateId of Object.keys(stateMap)) {
    if (
      matchesState(mappedStateId, stateId) &&
      (!foundStateId || stateId.length > foundStateId.length)
    ) {
      foundStateId = mappedStateId;
    }
  }

  return stateMap[foundStateId!];
}
