import type { AnyState, AnyStateMachine, State, StateFrom } from 'xstate';
import type { SetStoreFunction } from 'solid-js/store';
import { produce, reconcile } from 'solid-js/store';
import rfdc from 'rfdc';

// List of keys to reconcile while merging state
const reconcileKeys: Array<keyof AnyState> = ['context', 'value'];

/**
 * Reconcile the state of the machine with the current state of the store.
 * Handles primitive values, arrays, and objects.
 * Provides granular reactivity for the state of the machine in solid-js.
 */
export const updateState = <
  NextState extends StateFrom<AnyStateMachine> | object,
  UpdateState extends SetStoreFunction<NextState>
>(
  nextState: NextState,
  setState: UpdateState,
  keys?: Array<keyof NextState>
): void => {
  if (typeof nextState === 'object' && !!nextState) {
    if (!keys) {
      keys = Object.keys(nextState) as Array<keyof NextState>;
    }
    for (const key of keys) {
      if (typeof nextState[key] === 'function') {
        continue;
      }
      if (key in nextState && reconcileKeys.includes(key as keyof State<any>)) {
        setReconcileState(key, nextState, setState);
      } else {
        setProduceState(key, nextState, setState);
      }
    }
  } else {
    setState(nextState);
  }
};

const setProduceState = <
  NextState extends AnyState | object,
  UpdateState extends SetStoreFunction<NextState>
>(
  key: keyof NextState,
  nextState: NextState,
  setState: UpdateState
) =>
  setState(
    produce((s) => {
      s[key as any] = nextState[key];
    })
  );

const setReconcileState = <
  NextState extends AnyState | object,
  UpdateState extends SetStoreFunction<NextState>
>(
  key: keyof NextState,
  nextState: NextState,
  setState: UpdateState
) =>
  setState(
    key as any,
    typeof nextState[key] === 'object'
      ? reconcile<NextState[keyof NextState], unknown>(nextState[key])
      : nextState[key]
  );

// TODO: Replace with structuredClone when more broadly available
export const deepClone = rfdc({ circles: true, proto: true });
