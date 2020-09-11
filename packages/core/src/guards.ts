import {
  EventObject,
  StateValue,
  GuardPredicate,
  Condition,
  Guard
} from './types';
import { isStateId } from './stateUtils';
import { isString, toGuard } from './utils';
import { DEFAULT_GUARD_TYPE } from './constants';

export function stateIn<TContext, TEvent extends EventObject>(
  stateValue: StateValue
): GuardPredicate<TContext, TEvent> {
  return {
    type: DEFAULT_GUARD_TYPE,
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
    type: DEFAULT_GUARD_TYPE,
    name: '!In',
    predicate: (_, __, { state }) => {
      if (isString(stateValue) && isStateId(stateValue)) {
        return state.configuration.every((sn) => sn.id !== stateValue.slice(1));
      }

      return !state.matches(stateValue);
    }
  };
}

export function and<TContext, TEvent extends EventObject>(
  ...conditions: Array<Condition<TContext, TEvent>>
): GuardPredicate<TContext, TEvent> {
  return {
    type: DEFAULT_GUARD_TYPE,
    name: 'And',
    children: conditions.map((guard) => toGuard(guard)),
    predicate: (context, event, { cond }) => {
      return cond.children.every((guard: Guard<TContext, TEvent>) =>
        // TODO: should parent or child guard be passed as 3rd arg?
        guard.predicate(context, event, guard)
      );
    }
  };
}
