import isDevelopment from '#is-development';
import type {
  EventObject,
  StateValue,
  MachineContext,
  ParameterizedObject,
  AnyMachineSnapshot,
  NoRequiredParams,
  NoInfer,
  WithDynamicParams
} from './types.ts';
import { isStateId } from './stateUtils.ts';

export type GuardPredicate<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TGuard extends ParameterizedObject
> = {
  (args: GuardArgs<TContext, TExpressionEvent>, params: TParams): boolean;
  _out_TGuard?: TGuard;
};

export interface GuardArgs<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> {
  context: TContext;
  event: TExpressionEvent;
}

export type Guard<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TGuard extends ParameterizedObject
> =
  | NoRequiredParams<TGuard>
  | WithDynamicParams<TContext, TExpressionEvent, TGuard>
  | GuardPredicate<TContext, TExpressionEvent, TParams, TGuard>;

export type UnknownGuard = UnknownReferencedGuard | UnknownInlineGuard;

type UnknownReferencedGuard = Guard<
  MachineContext,
  EventObject,
  ParameterizedObject['params'],
  ParameterizedObject
>;

type UnknownInlineGuard = Guard<
  MachineContext,
  EventObject,
  undefined,
  ParameterizedObject
>;

interface BuiltinGuard {
  (): boolean;
  check: (
    state: AnyMachineSnapshot,
    guardArgs: GuardArgs<any, any>,
    params: unknown
  ) => boolean;
}

function checkStateIn(
  state: AnyMachineSnapshot,
  _: GuardArgs<any, any>,
  { stateValue }: { stateValue: StateValue }
) {
  if (typeof stateValue === 'string' && isStateId(stateValue)) {
    const target = state.machine.getStateNodeById(stateValue);
    return state.configuration.some((sn) => sn === target);
  }

  return state.matches(stateValue);
}

export function stateIn<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined
>(
  stateValue: StateValue
): GuardPredicate<
  TContext,
  TExpressionEvent,
  TParams,
  any // TODO: recheck if we could replace this with something better here
> {
  function stateIn(
    args: GuardArgs<TContext, TExpressionEvent>,
    params: TParams
  ) {
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
  state: AnyMachineSnapshot,
  { context, event }: GuardArgs<any, any>,
  { guards }: { guards: readonly UnknownGuard[] }
) {
  return !evaluateGuard(guards[0], context, event, state);
}

export function not<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TGuard extends ParameterizedObject
>(
  guard: Guard<TContext, TExpressionEvent, TParams, NoInfer<TGuard>>
): GuardPredicate<TContext, TExpressionEvent, TParams, TGuard> {
  function not(args: GuardArgs<TContext, TExpressionEvent>, params: TParams) {
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
  state: AnyMachineSnapshot,
  { context, event }: GuardArgs<any, any>,
  { guards }: { guards: readonly UnknownGuard[] }
) {
  return guards.every((guard) => evaluateGuard(guard, context, event, state));
}

export function and<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TGuard extends ParameterizedObject
>(
  guards: ReadonlyArray<
    Guard<TContext, TExpressionEvent, TParams, NoInfer<TGuard>>
  >
): GuardPredicate<TContext, TExpressionEvent, TParams, TGuard> {
  function and(args: GuardArgs<TContext, TExpressionEvent>, params: TParams) {
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
  state: AnyMachineSnapshot,
  { context, event }: GuardArgs<any, any>,
  { guards }: { guards: readonly UnknownGuard[] }
) {
  return guards.some((guard) => evaluateGuard(guard, context, event, state));
}

export function or<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TGuard extends ParameterizedObject
>(
  guards: ReadonlyArray<
    Guard<TContext, TExpressionEvent, TParams, NoInfer<TGuard>>
  >
): GuardPredicate<TContext, TExpressionEvent, TParams, TGuard> {
  function or(args: GuardArgs<TContext, TExpressionEvent>, params: TParams) {
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
  guard: UnknownGuard | UnknownInlineGuard,
  context: TContext,
  event: TExpressionEvent,
  state: AnyMachineSnapshot
): boolean {
  const { machine } = state;
  const isInline = typeof guard === 'function';

  const resolved = isInline
    ? guard
    : machine.implementations.guards[
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
    return evaluateGuard(resolved!, context, event, state);
  }

  const guardArgs = {
    context,
    event
  };

  const guardParams =
    isInline || typeof guard === 'string'
      ? undefined
      : 'params' in guard
      ? typeof guard.params === 'function'
        ? guard.params({ context, event })
        : guard.params
      : undefined;

  if (!('check' in resolved)) {
    // the existing type of `.guards` assumes non-nullable `TExpressionGuard`
    // inline guards expect `TExpressionGuard` to be set to `undefined`
    // it's fine to cast this here, our logic makes sure that we call those 2 "variants" correctly
    return resolved(guardArgs, guardParams as never);
  }

  const builtinGuard = resolved as unknown as BuiltinGuard;

  return builtinGuard.check(
    state,
    guardArgs,
    resolved // this holds all params
  );
}
