import type { SetStoreFunction } from 'solid-js/store';
import { reconcile } from 'solid-js/store';

/**
 * Reconcile the state of the machine with the current state of the store.
 * Handles primitive values, arrays, and objects.
 * Provides granular reactivity for the state of the machine in SolidJS.
 * @param nextState The next state value to update current store with
 * @param setState A Solid store setter
 */
export function updateState<NextState extends object>(
  nextState: NextState,
  setState: SetStoreFunction<NextState>
): void {
  if (typeof nextState === 'object' && !!nextState) {
    setState(reconcile<NextState, unknown>(nextState));
  } else {
    setState(nextState);
  }
}
