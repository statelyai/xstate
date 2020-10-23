import {
  EventObject,
  StateValue,
  BooleanGuardDefinition,
  GuardConfig,
  GuardDefinition,
  GuardMeta,
  SCXML
} from './types';
import { isStateId } from './stateUtils';
import { isString, toGuard } from './utils';
import { MachineNode } from './MachineNode';
import { State } from './State';

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
    children: [toGuard(guard)],
    predicate: (ctx, e, meta) => {
      return !meta.guard.children![0].predicate?.(ctx, e, {
        ...meta,
        guard: meta.guard.children![0]
      });
    }
  };
}

export function and<TContext, TEvent extends EventObject>(
  ...guards: Array<GuardConfig<TContext, TEvent>>
): BooleanGuardDefinition<TContext, TEvent> {
  return {
    type: 'xstate.boolean',
    params: { op: 'and' },
    children: guards.map((guard) => toGuard(guard)),
    predicate: (ctx, e, meta) => {
      return meta.guard.children!.every((childGuard) => {
        return childGuard.predicate?.(ctx, e, {
          ...meta,
          guard: childGuard
        });
      });
    }
  };
}

export function or<TContext, TEvent extends EventObject>(
  ...guards: Array<GuardConfig<TContext, TEvent>>
): BooleanGuardDefinition<TContext, TEvent> {
  return {
    type: 'xstate.boolean',
    params: { op: 'or' },
    children: guards.map((guard) => toGuard(guard)),
    predicate: (ctx, e, meta) => {
      return meta.guard.children!.some((childGuard) => {
        return childGuard.predicate?.(ctx, e, {
          ...meta,
          guard: childGuard
        });
      });
    }
  };
}

export function evaluateGuard<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, TEvent>,
  guard: GuardDefinition<TContext, TEvent>,
  context: TContext,
  _event: SCXML.Event<TEvent>,
  state: State<TContext, TEvent>
): boolean {
  const { guards } = machine.options;
  const guardMeta: GuardMeta<TContext, TEvent> = {
    state,
    guard,
    _event
  };

  const predicate = guards[guard.type] || guard.predicate;

  if (!predicate) {
    throw new Error(
      `Guard '${guard.type}' is not implemented on machine '${machine.id}'.`
    );
  }

  return predicate(context, _event.data, guardMeta);
}
