import isDevelopment from '#is-development';
import type {
  EventObject,
  StateValue,
  MachineContext,
  TODO,
  ParameterizedObject,
  AnyState,
  NoRequiredParams
} from './types.ts';
import { isStateId } from './stateUtils.ts';
import { State } from './State.ts';

export type GuardPredicate<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TGuard extends ParameterizedObject
> = (args: GuardArgs<TContext, TExpressionEvent, TGuard>) => boolean;

export interface GuardArgs<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TGuard extends ParameterizedObject | undefined
> {
  context: TContext;
  event: TExpressionEvent;
  guard: TGuard;
}

export type Guard<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TGuard extends ParameterizedObject
> =
  | NoRequiredParams<TGuard>
  | TGuard
  | GuardPredicate<TContext, TEvent, TGuard>;

export type UnknownGuard = Guard<
  MachineContext,
  EventObject,
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
  TEvent extends EventObject,
  TGuard extends ParameterizedObject
>(stateValue: StateValue) {
  function stateIn(_: GuardArgs<TContext, TEvent, TGuard>) {
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
  TEvent extends EventObject,
  TGuard extends ParameterizedObject
>(guard: Guard<TContext, TEvent, TGuard>) {
  function not() {
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
  TEvent extends EventObject,
  TGuard extends ParameterizedObject
>(guards: ReadonlyArray<Guard<TContext, TEvent, TGuard>>) {
  function and() {
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
  TEvent extends EventObject,
  TGuard extends ParameterizedObject
>(guards: ReadonlyArray<Guard<TContext, TEvent, TGuard>>) {
  function or() {
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
  TEvent extends EventObject
>(
  guard: UnknownGuard,
  context: TContext,
  event: TEvent,
  state: State<TContext, TEvent, TODO, TODO>
): boolean {
  const { machine } = state;
  const isInline = typeof guard === 'function';

  const resolved = isInline
    ? guard
    : machine.implementations.guards?.[
        typeof guard === 'string' ? guard : guard.type
      ];

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
    return resolved(guardArgs as any); // TODO: fix this by introducing `TExpressionGuard`, `| undefined`, etc
  }

  const builtinGuard = resolved as unknown as BuiltinGuard;

  return builtinGuard.check(
    state,
    guardArgs,
    resolved // this holds all params
  );
}
