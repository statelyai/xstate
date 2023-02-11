import { AnyState, matchesState } from 'xstate';
import type { CheckSnapshot } from './types';

function isState(state: any): state is AnyState {
  return (
    typeof state === 'object' &&
    'value' in state &&
    'context' in state &&
    'event' in state &&
    '_event' in state &&
    'can' in state &&
    'matches' in state
  );
}

/**
 * Takes in an interpreter or actor ref and returns a State object with reactive
 * methods or if not State, the initial value passed in
 * @param state {AnyState | unknown}
 * @param prevState {AnyState | unknown}
 */
export const deriveServiceState = <
  StateSnapshot extends AnyState,
  StateReturnType = CheckSnapshot<StateSnapshot>
>(
  state: StateSnapshot | unknown,
  prevState?: StateSnapshot | unknown
): StateReturnType => {
  if (isState(state)) {
    return {
      ...state,
      toJSON: state.toJSON,
      toStrings: state.toStrings,
      can: state.can,
      hasTag: state.hasTag,
      nextEvents: state.nextEvents,
      matches:
        prevState && isState(prevState)
          ? prevState.matches
          : function (parentStateValue: any) {
              return matchesState(parentStateValue, this.value);
            }
    } as StateReturnType;
  } else {
    return state as StateReturnType;
  }
};
