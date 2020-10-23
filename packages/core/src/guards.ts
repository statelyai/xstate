import {
  EventObject,
  StateValue,
  BooleanGuardObject,
  BooleanGuardDefinition,
  GuardConfig,
  GuardDefinition
} from './types';
import { isStateId } from './stateUtils';
import { isString, toGuard } from './utils';

export function stateIn<TContext, TEvent extends EventObject>(
  stateValue: StateValue
): GuardDefinition<TContext, TEvent> {
  return {
    type: 'xstate.guard:in',
    params: { stateValue },
    predicate: (_, __, { state }) => {
      if (isString(stateValue) && isStateId(stateValue)) {
        return state.configuration.some((sn) => sn.id === stateValue.slice(1));
      }

      return state.matches(stateValue);
    }
  };
}

export function not<TContext, TEvent extends EventObject>(
  guard: GuardConfig<TContext, TEvent>
): BooleanGuardDefinition<TContext, TEvent> {
  return {
    type: 'xstate.boolean',
    params: { op: 'not' },
    children: [toGuard(guard)]
  };
}

export function and<TContext, TEvent extends EventObject>(
  ...guards: Array<GuardConfig<TContext, TEvent>>
): BooleanGuardObject<TContext, TEvent> {
  return {
    type: 'xstate.boolean',
    params: { op: 'and' },
    children: guards.map((guard) => toGuard(guard))
  };
}

export function or<TContext, TEvent extends EventObject>(
  ...guards: Array<GuardConfig<TContext, TEvent>>
): BooleanGuardObject<TContext, TEvent> {
  return {
    type: 'xstate.boolean',
    params: { op: 'or' },
    children: guards.map((guard) => toGuard(guard))
  };
}
