import type { State } from 'xstate';
import type {
  DeepReadonly,
  Next,
  Part,
  SetStoreFunction
} from 'solid-js/store';
import { produce, reconcile } from 'solid-js/store';
import rfdc from 'rfdc';

// List of keys to produce instead of reconcile while merging state
export const produceKeys: Array<keyof State<any>> = [
  'historyValue',
  'history',
  'event',
  '_event',
  'actions',
  'activities',
  'meta',
  'events',
  'nextEvents',
  'transitions',
  'machine',
  'tags'
];

/**
 * Reconcile the state of the machine with the current state of the store.
 * Handles primitive values, arrays, and objects.
 * Provides granular reactivity for the state of the machine in solid-js.
 */
export const updateState = <
  NextState extends State<any> | object,
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
      if (key in nextState && !produceKeys.includes(key as keyof State<any>)) {
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
  NextState extends State<any> | object,
  UpdateState extends SetStoreFunction<NextState>
>(
  key: keyof NextState,
  nextState: NextState,
  setState: UpdateState
) =>
  setState(
    produce((s) => {
      s[key] = nextState[key];
    })
  );

const setReconcileState = <
  NextState extends State<any> | object,
  UpdateState extends SetStoreFunction<NextState>
>(
  key: keyof NextState,
  nextState: NextState,
  setState: UpdateState
) =>
  setState(
    key as Part<DeepReadonly<NextState>>,
    (typeof nextState[key] === 'object'
      ? reconcile(nextState[key])
      : nextState[key]) as Partial<
      Next<DeepReadonly<NextState>, Part<DeepReadonly<NextState>>>
    >
  );

// TODO: Replace with structuredClone when more broadly available
export const deepClone = rfdc({circles: true, proto: true});
