import isDevelopment from '#is-development';
import type {
  EventObject,
  StateValue,
  MachineContext,
  ParameterizedObject,
  AnyState,
  NoRequiredParams
} from './types.ts';
import { isStateId } from './stateUtils.ts';

export type GuardPredicate<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionGuard extends ParameterizedObject | undefined,
  TGuard extends ParameterizedObject
> = {
  (args: GuardArgs<TContext, TExpressionEvent, TExpressionGuard>): boolean;
  _out_TGuard?: TGuard;
};

export interface GuardArgs<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionGuard extends ParameterizedObject | undefined
> {
  context: TContext;
  event: TExpressionEvent;
  guard: TExpressionGuard;
}

export type Guard<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionGuard extends ParameterizedObject | undefined,
  TGuard extends ParameterizedObject
> =
  | NoRequiredParams<TGuard>
  | TGuard
  | GuardPredicate<TContext, TExpressionEvent, TExpressionGuard, TGuard>;

export type UnknownGuard = Guard<
  MachineContext,
  EventObject,
  ParameterizedObject | undefined,
  ParameterizedObject
>;

interface BuiltinGuard {
  (): boolean;
  check: (
    state: AnyState,
    guardArgs: GuardArgs<any, any, any>,
    params: unknown
  ) => boolean;
}

function checkStateIn(
  state: AnyState,
  _: GuardArgs<any, any, any>,
  { stateValue }: { stateValue: StateValue }
) {
  if (typeof stateValue === 'string' && isStateId(stateValue)) {
    return state.configuration.some((sn) => sn.id === stateValue.slice(1));
  }

  return state.matches(stateValue);
}

export function stateIn<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionGuard extends ParameterizedObject | undefined
>(stateValue: StateValue) {
  function stateIn(_: GuardArgs<TContext, TExpressionEvent, TExpressionGuard>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
    return false;
  }

  stateIn.check = checkStateIn;
  stateIn.stateValue = stateValue;

  return stateIn;
}

function checkNot(
  state: AnyState,
  { context, event }: GuardArgs<any, any, any>,
  { guards }: { guards: readonly UnknownGuard[] }
) {
  return !evaluateGuard(guards[0], context, event, state);
}

export function not<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionGuard extends ParameterizedObject | undefined,
  TGuard extends ParameterizedObject
>(guard: Guard<TContext, TExpressionEvent, TExpressionGuard, TGuard>) {
  function not(_: GuardArgs<TContext, TExpressionEvent, TExpressionGuard>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
    return false;
  }

  not.check = checkNot;
  not.guards = [guard];

  return not;
}

function checkAnd(
  state: AnyState,
  { context, event }: GuardArgs<any, any, any>,
  { guards }: { guards: readonly UnknownGuard[] }
) {
  return guards.every((guard) => evaluateGuard(guard, context, event, state));
}

export function and<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionGuard extends ParameterizedObject | undefined,
  TGuard extends ParameterizedObject
>(
  guards: ReadonlyArray<
    Guard<TContext, TExpressionEvent, TExpressionGuard, TGuard>
  >
) {
  function and(_: GuardArgs<TContext, TExpressionEvent, TExpressionGuard>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
    return false;
  }

  and.check = checkAnd;
  and.guards = guards;

  return and;
}

function checkOr(
  state: AnyState,
  { context, event }: GuardArgs<any, any, any>,
  { guards }: { guards: readonly UnknownGuard[] }
) {
  return guards.some((guard) => evaluateGuard(guard, context, event, state));
}

export function or<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionGuard extends ParameterizedObject | undefined,
  TGuard extends ParameterizedObject
>(
  guards: ReadonlyArray<
    Guard<TContext, TExpressionEvent, TExpressionGuard, TGuard>
  >
) {
  function or(_: GuardArgs<TContext, TExpressionEvent, TExpressionGuard>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
    return false;
  }

  or.check = checkOr;
  or.guards = guards;

  return or;
}

// TODO: throw on cycles (depth check should be enough)
export function evaluateGuard<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
>(
  guard: UnknownGuard,
  context: TContext,
  event: TExpressionEvent,
  state: AnyState
): boolean {
  const { machine } = state;
  const isInline = typeof guard === 'function';

  const resolved = isInline
    ? guard
    : // the existing type of `.guards` assumes non-nullable `TExpressionGuard`
      // it's fine to cast this here to get a common type and lack of errors in the rest of the code
      // our logic below makes sure that we call those 2 "variants" correctly
      (
        machine.implementations.guards as Record<
          string,
          GuardPredicate<
            MachineContext,
            EventObject,
            ParameterizedObject | undefined,
            ParameterizedObject
          >
        >
      )[typeof guard === 'string' ? guard : guard.type];

  if (!isInline && !resolved) {
    throw new Error(
      `Guard '${
        typeof guard === 'string' ? guard : guard.type
      }' is not implemented.'.`
    );
  }

  if (typeof resolved !== 'function') {
    return evaluateGuard(resolved, context, event, state);
  }

  const guardArgs = {
    context,
    event,
    guard: isInline
      ? undefined
      : typeof guard === 'string'
      ? { type: guard }
      : guard
  };

  if (!('check' in resolved)) {
    return resolved(guardArgs);
  }

  const builtinGuard = resolved as unknown as BuiltinGuard;

  return builtinGuard.check(
    state,
    guardArgs,
    resolved // this holds all params
  );
}
