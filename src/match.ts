import { State } from './State';
import { StateValue, EventObject } from './types';

export type ValueFromStateGetter<T, TContext, TEvent extends EventObject> = (
  state: State<TContext, TEvent>
) => T;

export type StatePatternTuple<T, TContext, TEvent extends EventObject> = [
  StateValue,
  ValueFromStateGetter<T, TContext, TEvent>
];

export function matchState<T, TContext, TEvent extends EventObject>(
  state: State<TContext, TEvent>,
  patterns: Array<StatePatternTuple<T, TContext, TEvent>>,
  defaultValue: ValueFromStateGetter<T, TContext, TEvent>
): T {
  for (const [stateValue, getValue] of patterns) {
    if (state.matches(stateValue)) {
      return getValue(state);
    }
  }

  return defaultValue(state);
}
