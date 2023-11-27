import isDevelopment from '#is-development';
import { GuardPredicate, evaluateGuard } from '../guards.ts';
import {
  Actions,
  ActionArgs,
  UnknownAction,
  AnyActorScope,
  AnyMachineSnapshot,
  EventObject,
  MachineContext,
  ParameterizedObject,
  SingleOrArray,
  NoInfer,
  ProvidedActor,
  ActionFunction,
  AnyState
} from '../types.ts';
import { toArray } from '../utils.ts';
import { assign } from './assign.ts';
import { raise } from './raise.ts';
import { sendTo } from './send.ts';
import { spawnChild } from './spawnChild.ts';

function resolvePure(
  _: AnyActorScope,
  state: AnyMachineSnapshot,
  args: ActionArgs<any, any, any>,
  _actionParams: ParameterizedObject['params'] | undefined,
  {
    get
  }: {
    get: ({
      context,
      event
    }: {
      context: MachineContext;
      event: EventObject;
    }) => SingleOrArray<UnknownAction> | undefined;
  }
) {
  return [
    state,
    undefined,
    toArray(get({ context: args.context, event: args.event }))
  ];
}

export interface PureAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: unknown): void;
  _out_TEvent?: TEvent;
  _out_TActor?: TActor;
  _out_TAction?: TAction;
  _out_TGuard?: TGuard;
  _out_TDelay?: TDelay;
}

/**
 *
 * @deprecated Use `createAction(...)` instead
 */
export function pure<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = string
>(
  getActions: ({
    context,
    event
  }: {
    context: TContext;
    event: TExpressionEvent;
  }) =>
    | Actions<
        TContext,
        TExpressionEvent,
        NoInfer<TEvent>,
        undefined,
        TActor,
        NoInfer<TAction>,
        NoInfer<TGuard>,
        TDelay
      >
    | undefined
): PureAction<
  TContext,
  TExpressionEvent,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TDelay
> {
  function pure(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: unknown
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  pure.type = 'xstate.pure';
  pure.get = getActions;

  pure.resolve = resolvePure;

  return pure;
}

interface CreateActionEnqueuer {
  assign: (...args: Parameters<typeof assign<any, any, any, any, any>>) => void;
  raise: (...args: Parameters<typeof raise<any, any, any, any, any>>) => void;
  sendTo: (
    ...args: Parameters<typeof sendTo<any, any, any, any, any, any>>
  ) => void;
  spawn: (
    ...args: Parameters<typeof spawnChild<any, any, any, any, any>>
  ) => void;
  action: (
    action:
      | ActionFunction<any, any, any, any, any, any, any, any>
      | {
          type: string;
        }
  ) => void;
}

function resolveCreateAction(
  _: AnyActorScope,
  state: AnyState,
  args: ActionArgs<any, any, any>,
  _actionParams: ParameterizedObject['params'] | undefined,
  {
    get
  }: {
    get: ({
      context,
      event,
      enqueue,
      guard
    }: {
      context: MachineContext;
      event: EventObject;
      enqueue: CreateActionEnqueuer;
      guard: (guard: any) => boolean;
    }) => SingleOrArray<UnknownAction> | undefined;
  }
) {
  const actions: any[] = [];
  const exec: CreateActionEnqueuer = {
    assign: (...args) => {
      actions.push(assign(...args));
    },
    raise: (...args) => {
      actions.push(raise(...args));
    },
    sendTo: (...args) => {
      actions.push(sendTo(...args));
    },
    action: (action) => {
      actions.push(action);
    },
    spawn: (...args) => {
      actions.push(spawnChild(...args));
    }
  };
  const guard = (guard: any) => {
    return evaluateGuard(guard, state.context, args.event, state);
  };
  get({ context: args.context, event: args.event, enqueue: exec, guard });
  return [state, undefined, actions];
}

export function enqueueActions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined =
    | ParameterizedObject['params']
    | undefined,
  TEvent extends EventObject = TExpressionEvent,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = string
>(
  getActions: ({
    context,
    event,
    enqueue
  }: {
    context: TContext;
    event: TExpressionEvent;
    guard: (
      guard:
        | TGuard
        | GuardPredicate<TContext, TExpressionEvent, undefined, TGuard>
    ) => boolean;
    enqueue: {
      assign: (
        ...args: Parameters<
          typeof assign<TContext, TExpressionEvent, any, TEvent, TActor>
        >
      ) => void;
      raise: (
        ...args: Parameters<
          typeof raise<TContext, TExpressionEvent, TEvent, any, TDelay>
        >
      ) => void;
      sendTo: (
        ...args: Parameters<
          typeof sendTo<TContext, TExpressionEvent, any, any, TEvent, TDelay>
        >
      ) => void;
      spawn: (
        ...args: Parameters<
          typeof spawnChild<TContext, TExpressionEvent, any, TEvent, TActor>
        >
      ) => void;
      action: (
        action:
          | TAction
          | ActionFunction<
              TContext,
              TExpressionEvent,
              TEvent,
              any,
              TActor,
              TAction,
              TGuard,
              TDelay
            >
      ) => void;
    };
  }) => void
): PureAction<
  TContext,
  TExpressionEvent,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TDelay
> {
  function enqueueActions(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  enqueueActions.type = 'xstate.action';
  enqueueActions.get = getActions;

  enqueueActions.resolve = resolveCreateAction;

  // TODO: fix this type
  return enqueueActions;
}
