import isDevelopment from '#is-development';
import type {
  EventObject,
  StateValue,
  MachineContext,
  ParameterizedObject,
  AnyMachineSnapshot,
  NoRequiredParams,
  NoInfer,
  WithDynamicParams,
  Identity,
  Elements
} from './types.ts';
import { isStateId } from './stateUtils.ts';

type SingleGuardArg<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TGuardArg
> = [TGuardArg] extends [{ type: string }]
  ? Identity<TGuardArg>
  : [TGuardArg] extends [string]
    ? TGuardArg
    : GuardPredicate<TContext, TExpressionEvent, TParams, ParameterizedObject>;

type NormalizeGuardArg<TGuardArg> = TGuardArg extends { type: string }
  ? Identity<TGuardArg> & { params: unknown }
  : TGuardArg extends string
    ? { type: TGuardArg; params: undefined }
    : '_out_TGuard' extends keyof TGuardArg
      ? TGuardArg['_out_TGuard'] & ParameterizedObject
      : never;

type NormalizeGuardArgArray<TArg extends unknown[]> = Elements<{
  [K in keyof TArg]: NormalizeGuardArg<TArg[K]>;
}>;

type LogicGuards<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TArg extends unknown[]
> = readonly [
  ...{
    [K in keyof TArg]: SingleGuardArg<
      TContext,
      TExpressionEvent,
      unknown,
      TArg[K]
    >;
  }
];

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

type BuiltinPredicate<Params extends Record<string, any>> = (
  snapshot: AnyMachineSnapshot,
  args: GuardArgs<any, any>,
  params: Params
) => boolean;

interface BuiltinGuard {
  (): boolean;
  [BuiltinGuardKey]: {
    check: BuiltinPredicate<any>;
    params: Record<string, any>;
  };
}

type BuiltinPredicateGuard = UnknownGuard | GuardPredicate<any, any, any, any>;

type BuiltinGuardKey = typeof BuiltinGuardKey;
const BuiltinGuardKey = Symbol();

function builtinGuard<
  TBuiltinPredicate extends BuiltinPredicate<TParams>,
  TParams extends Record<string, any>
>(check: TBuiltinPredicate, params: TParams) {
  const builtinGuard: BuiltinGuard = function builtinGuard() {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
    return false;
  };

  builtinGuard[BuiltinGuardKey] = {
    check,
    params
  };

  return builtinGuard;
}

function isBuiltinGuard(guard: any): guard is BuiltinGuard {
  return BuiltinGuardKey in guard;
}

const checkStateIn: BuiltinPredicate<{ stateValue: StateValue }> =
  function checkStateIn(snapshot, _, { stateValue }) {
    if (typeof stateValue === 'string' && isStateId(stateValue)) {
      const target = snapshot.machine.getStateNodeById(stateValue);
      return snapshot._nodes.some((sn) => sn === target);
    }

    return snapshot.matches(stateValue);
  };

/**
* Guard that evaluates to `true` when the `stateValue` passed to it matches the current machine state.
*
* @category Guards
* @example
  ```ts
  import { setup, stateIn } from 'xstate';

  const machine = setup({}).createMachine({
    on: {
      someEvent: {
        guard: stateIn('someState'),
        actions: () => {
          // will be executed if machine is in `someState`
        }
      }
    },
    states: {
      someState: {}
    }
  });
  ```
* @returns A guard
*/
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
  return builtinGuard(checkStateIn, { stateValue });
}

const checkNot: BuiltinPredicate<{ guards: readonly [BuiltinPredicateGuard] }> =
  function checkNot(snapshot, { context, event }, { guards }) {
    return !evaluateGuard(guards[0], context, event, snapshot);
  };

/**
* Higher-order guard that evaluates to `true` if the `guard` passed to it evaluates to `false`.
*
* @category Guards
* @example
  ```ts
  import { setup, not } from 'xstate';

  const machine = setup({
    guards: {
      someNamedGuard: () => false
    }
  }).createMachine({
    on: {
      someEvent: {
        guard: not('someNamedGuard'),
        actions: () => {
          // will be executed if guard in `not(...)`
          // evaluates to `false`
        }
      }
    }
  });
  ```
* @returns A guard
*/
export function not<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TArg
>(
  guard: SingleGuardArg<TContext, TExpressionEvent, unknown, TArg>
): GuardPredicate<
  TContext,
  TExpressionEvent,
  unknown,
  NormalizeGuardArg<NoInfer<TArg>>
> {
  return builtinGuard(checkNot, { guards: [guard] as const });
}

const checkAnd: BuiltinPredicate<{ guards: readonly BuiltinPredicateGuard[] }> =
  function checkAnd(snapshot, { context, event }, { guards }) {
    return guards.every((guard) =>
      evaluateGuard(guard, context, event, snapshot)
    );
  };

/**
* Higher-order guard that evaluates to `true` if all `guards` passed to it
* evaluate to `true`.
*
* @category Guards
* @example
  ```ts
  import { setup, and } from 'xstate';

  const machine = setup({
    guards: {
      someNamedGuard: () => true
    }
  }).createMachine({
    on: {
      someEvent: {
        guard: and([
          ({ context }) => context.value > 0,
          'someNamedGuard'
        ]),
        actions: () => {
          // will be executed if all guards in `and(...)`
          // evaluate to true
        }
      }
    }
  });
  ```
* @returns A guard action object
*/
export function and<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TArg extends unknown[]
>(
  guards: LogicGuards<TContext, TExpressionEvent, TArg>
): GuardPredicate<
  TContext,
  TExpressionEvent,
  unknown,
  NormalizeGuardArgArray<NoInfer<TArg>>
> {
  return builtinGuard(checkAnd, { guards });
}

const checkOr: BuiltinPredicate<{ guards: readonly BuiltinPredicateGuard[] }> =
  function checkOr(snapshot, { context, event }, { guards }) {
    return guards.some((guard) =>
      evaluateGuard(guard, context, event, snapshot)
    );
  };

/**
* Higher-order guard that evaluates to `true` if any of the `guards` passed to it
* evaluate to `true`.
*
* @category Guards
* @example
  ```ts
  import { setup, or } from 'xstate';

  const machine = setup({
    guards: {
      someNamedGuard: () => true
    }
  }).createMachine({
    on: {
      someEvent: {
        guard: or([
          ({ context }) => context.value > 0,
          'someNamedGuard'
        ]),
        actions: () => {
          // will be executed if any of the guards in `or(...)`
          // evaluate to true
        }
      }
    }
  });
  ```
* @returns A guard action object
*/
export function or<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TArg extends unknown[]
>(
  guards: LogicGuards<TContext, TExpressionEvent, TArg>
): GuardPredicate<
  TContext,
  TExpressionEvent,
  unknown,
  NormalizeGuardArgArray<NoInfer<TArg>>
> {
  return builtinGuard(checkOr, { guards });
}

// TODO: throw on cycles (depth check should be enough)
export function evaluateGuard<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
>(
  guard: UnknownGuard,
  context: TContext,
  event: TExpressionEvent,
  snapshot: AnyMachineSnapshot
): boolean {
  const { machine } = snapshot;

  const isInline = typeof guard === 'function';
  const isString = typeof guard === 'string';

  const key = isInline ? (undefined as never) : isString ? guard : guard.type;
  const resolved = isInline ? guard : machine.implementations.guards[key];

  const guardArgs = {
    context,
    event
  };

  if (!resolved) {
    throw new Error(`Guard '${key}' is not implemented.`);
  } else if (typeof resolved === 'string') {
    return evaluateGuard(resolved, context, event, snapshot);
  } else if (isBuiltinGuard(resolved)) {
    const { check, params } = resolved[BuiltinGuardKey];
    return check(snapshot, guardArgs, params);
  } else {
    const guardParams =
      isInline || isString
        ? undefined
        : 'params' in guard
          ? typeof guard.params === 'function'
            ? guard.params({ context, event })
            : guard.params
          : undefined;
    return resolved(guardArgs, guardParams);
  }
}
