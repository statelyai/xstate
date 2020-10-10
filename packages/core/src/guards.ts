import { EventObject, StateValue, GuardPredicate } from './types';
import { isStateId } from './stateUtils';
import { isString } from './utils';

export function stateIn<TContext, TEvent extends EventObject>(
  stateValue: StateValue
): GuardPredicate<TContext, TEvent> {
  return {
    type: 'xstate.guard',
    name: 'In',
    predicate: (_, __, { state }) => {
      if (isString(stateValue) && isStateId(stateValue)) {
        return state.configuration.some((sn) => sn.id === stateValue.slice(1));
      }

      return state.matches(stateValue);
    }
  };
}

export function stateNotIn<TContext, TEvent extends EventObject>(
  stateValue: StateValue
): GuardPredicate<TContext, TEvent> {
  return {
    type: 'xstate.guard',
    name: '!In',
    predicate: (_, __, { state }) => {
      if (isString(stateValue) && isStateId(stateValue)) {
        return state.configuration.every((sn) => sn.id !== stateValue.slice(1));
      }

      return !state.matches(stateValue);
    }
  };
}
