import { AnyMachineSnapshot, Snapshot } from 'xstate';

function isState(state: any): state is AnyMachineSnapshot {
  return (
    !!state &&
    typeof state === 'object' &&
    'value' in state &&
    'context' in state &&
    'can' in state &&
    'matches' in state
  );
}

function reactiveMethod<T, Args extends unknown[], R>(
  method: (this: T, ...args: Args) => R
) {
  return function (this: T, ...args: Args) {
    return method.apply(this, args);
  };
}

/**
 * Takes in an interpreter or actor ref and returns a State object with reactive
 * methods or if not State, the initial value passed in
 * @param state {AnyMachineSnapshot | unknown}
 * @param prevState {AnyMachineSnapshot | unknown}
 */
export const deriveServiceState = <T extends unknown>(
  state: Snapshot<T>,
  prevState?: Snapshot<T>
) => {
  if (isState(state)) {
    const shouldKeepReactiveMethods = prevState && isState(prevState);
    return {
      ...state,
      can: shouldKeepReactiveMethods
        ? prevState.can
        : reactiveMethod(state.can),
      hasTag: shouldKeepReactiveMethods
        ? prevState.hasTag
        : reactiveMethod(state.hasTag),
      matches: shouldKeepReactiveMethods
        ? prevState.matches
        : reactiveMethod(state.matches)
    };
  }
  return state;
};
