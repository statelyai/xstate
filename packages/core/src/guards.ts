import isDevelopment from '#is-development';
import type {
  EventObject,
  StateValue,
  MachineContext,
  ParameterizedObject,
  AnyState,
  NoRequiredParams,
  NoInfer,
  WithDynamicParams
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
  | WithDynamicParams<TContext, TExpressionEvent, TGuard>
  | GuardPredicate<TContext, TExpressionEvent, TExpressionGuard, TGuard>;

export type UnknownGuard = UnknownReferencedGuard | UnknownInlineGuard;

type UnknownReferencedGuard = Guard<
  MachineContext,
  EventObject,
  ParameterizedObject,
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

  return stateIn as GuardPredicate<
    TContext,
    TExpressionEvent,
    TExpressionGuard,
    any // TODO: recheck if we could replace this with something better here
  >;
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
>(guard: Guard<TContext, TExpressionEvent, TExpressionGuard, NoInfer<TGuard>>) {
  function not(_: GuardArgs<TContext, TExpressionEvent, TExpressionGuard>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
    return false;
  }

  not.check = checkNot;
  not.guards = [guard];

  return not as GuardPredicate<
    TContext,
    TExpressionEvent,
    TExpressionGuard,
    TGuard
  >;
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
    Guard<TContext, TExpressionEvent, TExpressionGuard, NoInfer<TGuard>>
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

  return and as GuardPredicate<
    TContext,
    TExpressionEvent,
    TExpressionGuard,
    TGuard
  >;
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
    Guard<TContext, TExpressionEvent, TExpressionGuard, NoInfer<TGuard>>
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

  return or as GuardPredicate<
    TContext,
    TExpressionEvent,
    TExpressionGuard,
    TGuard
  >;
}

// TODO: throw on cycles (depth check should be enough)
export function evaluateGuard<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
>(
  guard: UnknownGuard | UnknownInlineGuard,
  context: TContext,
  event: TExpressionEvent,
  state: AnyState
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
    event,
    guard: isInline
      ? undefined
      : typeof guard === 'string'
      ? { type: guard }
      : typeof guard.params === 'function'
      ? {
          type: guard.type,
          params: guard.params({ context, event })
        }
      : guard
  };

  if (!('check' in resolved)) {
    // the existing type of `.guards` assumes non-nullable `TExpressionGuard`
    // inline guards expect `TExpressionGuard` to be set to `undefined`
    // it's fine to cast this here, our logic makes sure that we call those 2 "variants" correctly
    return resolved(guardArgs as never);
  }

  const builtinGuard = resolved as unknown as BuiltinGuard;

  return builtinGuard.check(
    state,
    guardArgs,
    resolved // this holds all params
  );
}
