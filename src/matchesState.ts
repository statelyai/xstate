import { toStatePath } from './index'; // TODO: change to utils
import { StateKey } from './types';

export default function matchesState(
  parentStateId: StateKey,
  childStateId: StateKey
): boolean {
  const parentStatePath = toStatePath(parentStateId);
  const childStatePath = toStatePath(childStateId);

  if (parentStatePath.length > childStatePath.length) {
    return false;
  }

  for (const i in parentStatePath) {
    if (parentStatePath[i] !== childStatePath[i]) {
      return false;
    }
  }

  return true;
}
