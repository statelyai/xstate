import type { AnyState, State } from 'xstate';
import type { SetStoreFunction } from 'solid-js/store';
import { reconcile } from 'solid-js/store';
import rfdc from 'rfdc';

// List of keys to reconcile while merging state
const reconcileKeys: Array<keyof AnyState> = ['context'];

/**
 * Reconcile the state of the machine with the current state of the store.
 * Handles primitive values, arrays, and objects.
 * Provides granular reactivity for the state of the machine in solid-js.
 */
export const updateState = <NextState extends AnyState | object>(
  nextState: NextState,
  setState: SetStoreFunction<NextState>
): void => {
  if (typeof nextState === 'object' && !!nextState) {
    // If a list of keys to update is not provided, get keys from nextState
    const keys = Object.keys(nextState) as Array<keyof NextState>;
    for (const key of keys) {
      // Don't update functions
      if (typeof nextState[key] === 'function') {
        continue;
      }
      if (key in nextState && reconcileKeys.includes(key as keyof State<any>)) {
        setReconcileState(key, nextState, setState);
      } else {
        setState(key as any, nextState[key]);
      }
    }
  } else {
    setState(nextState);
  }
};

const setReconcileState = <NextState extends AnyState | object>(
  key: keyof NextState,
  nextState: NextState,
  setState: SetStoreFunction<NextState>
) =>
  setState(
    key as any,
    typeof nextState[key] === 'object'
      ? reconcile<NextState[keyof NextState], unknown>(nextState[key])
      : nextState[key]
  );

// TODO: Replace with structuredClone when more broadly available
export const deepClone = rfdc({ circles: true, proto: true });
