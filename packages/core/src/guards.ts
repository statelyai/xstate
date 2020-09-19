import {
  EventObject,
  StateValue,
  DefaultGuardObject,
  Condition,
  BooleanGuardObject,
  Guard,
  GuardDefinition
} from './types';
import { isStateId } from './stateUtils';
import { isString, toGuard } from './utils';
import { DEFAULT_GUARD_TYPE } from './constants';

export function stateIn<TContext, TEvent extends EventObject>(
  stateValue: StateValue
): DefaultGuardObject<TContext, TEvent> {
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

export function not<TContext, TEvent extends EventObject>(
  condition: Condition<TContext, TEvent>
): BooleanGuardObject<TContext, TEvent> {
  return {
    type: DEFAULT_GUARD_TYPE,
    op: 'not',
    children: [toGuard(condition)]
  };
}

export function and<TContext, TEvent extends EventObject>(
  ...conditions: Array<Condition<TContext, TEvent>>
): BooleanGuardObject<TContext, TEvent> {
  return {
    type: DEFAULT_GUARD_TYPE,
    op: 'and',
    children: conditions.map((guard) => toGuard(guard))
  };
}

export function or<TContext, TEvent extends EventObject>(
  ...conditions: Array<Condition<TContext, TEvent>>
): BooleanGuardObject<TContext, TEvent> {
  return {
    type: DEFAULT_GUARD_TYPE,
    op: 'or',
    children: conditions.map((guard) => toGuard(guard))
  };
}

export function toGuardDefinition<TC, TE extends EventObject>(
  guard: Guard<TC, TE>
): GuardDefinition<TC, TE> {
  return {
    type: guard.type,
    params: guard
  };
}
