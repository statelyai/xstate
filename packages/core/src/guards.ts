import type {
  EventObject,
  StateValue,
  BooleanGuardDefinition,
  GuardConfig,
  GuardDefinition,
  GuardPredicate,
  MachineContext
} from './types.ts';
import { isStateId } from './stateUtils.ts';
import { isFunction, isString } from './utils.ts';
import type { State } from './State.ts';

export function stateIn<
  TContext extends MachineContext,
  TEvent extends EventObject
>(stateValue: StateValue): GuardDefinition<TContext, TEvent> {
  return {
    type: 'xstate.guard:in',
    params: { stateValue },
    predicate: ({ state }) => {
      if (isString(stateValue) && isStateId(stateValue)) {
        return state.configuration.some((sn) => sn.id === stateValue.slice(1));
      }

      return state.matches(stateValue);
    }
  };
}

export function not<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  guard: GuardConfig<TContext, TEvent>
): BooleanGuardDefinition<TContext, TEvent> {
  return {
    type: 'xstate.boolean',
    params: { op: 'not' },
    children: [toGuardDefinition(guard)],
    predicate: ({ evaluate, guard, context, event, state }) => {
      return !evaluate(guard.children![0], context, event, state);
    }
  };
}

export function and<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  guards: Array<GuardConfig<TContext, TEvent>>
): BooleanGuardDefinition<TContext, TEvent> {
  return {
    type: 'xstate.boolean',
    params: { op: 'and' },
    children: guards.map((guard) => toGuardDefinition(guard)),
    predicate: ({ evaluate, guard, context, event, state }) => {
      return guard.children!.every((childGuard) => {
        return evaluate(childGuard, context, event, state);
      });
    }
  };
}

export function or<TContext extends MachineContext, TEvent extends EventObject>(
  guards: Array<GuardConfig<TContext, TEvent>>
): BooleanGuardDefinition<TContext, TEvent> {
  return {
    type: 'xstate.boolean',
    params: { op: 'or' },
    children: guards.map((guard) => toGuardDefinition(guard)),
    predicate: ({ evaluate, guard, context, event, state }) => {
      return guard.children!.some((childGuard) => {
        return evaluate(childGuard, context, event, state);
      });
    }
  };
}

export function evaluateGuard<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  guard: GuardDefinition<TContext, TEvent>,
  context: TContext,
  event: TEvent,
  state: State<TContext, TEvent>
): boolean {
  const { machine } = state;

  const predicate = machine?.options?.guards?.[guard.type] ?? guard.predicate;

  if (!predicate) {
    throw new Error(`Guard '${guard.type}' is not implemented.'.`);
  }

  return predicate({
    context,
    event,
    state,
    guard,
    evaluate: evaluateGuard
  });
}

export function toGuardDefinition<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  guardConfig: GuardConfig<TContext, TEvent>,
  getPredicate?: (
    guardType: string
  ) => GuardPredicate<TContext, TEvent> | GuardDefinition<TContext, TEvent>
): GuardDefinition<TContext, TEvent> {
  // TODO: do this recursively and check for cycles
  if (isString(guardConfig)) {
    const predicateOrDef = getPredicate?.(guardConfig);

    if (isFunction(predicateOrDef)) {
      return {
        type: guardConfig,
        predicate: predicateOrDef,
        params: { type: guardConfig }
      };
    } else if (predicateOrDef) {
      return predicateOrDef;
    } else {
      return {
        type: guardConfig,
        params: { type: guardConfig }
      };
    }
  }

  if (isFunction(guardConfig)) {
    return {
      type: guardConfig.name,
      predicate: guardConfig,
      params: {
        type: guardConfig.name,
        name: guardConfig.name
      }
    };
  }

  const predicateOrDef = getPredicate?.(guardConfig.type);

  if (isFunction(predicateOrDef)) {
    return {
      type: guardConfig.type,
      params: guardConfig.params || guardConfig,
      children: (
        guardConfig.children as Array<GuardConfig<TContext, TEvent>>
      )?.map((childGuard) => toGuardDefinition(childGuard, getPredicate)),
      predicate:
        getPredicate?.(guardConfig.type) || (guardConfig as any).predicate
    };
  } else if (predicateOrDef) {
    return predicateOrDef;
  } else {
    return {
      type: guardConfig.type,
      params: guardConfig.params || guardConfig,
      children: (
        guardConfig.children as Array<GuardConfig<TContext, TEvent>>
      )?.map((childGuard) => toGuardDefinition(childGuard, getPredicate)),
      predicate: (guardConfig as any).predicate
    };
  }
}
