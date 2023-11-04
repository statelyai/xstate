import isDevelopment from '#is-development';
import {
  Actions,
  ActionArgs,
  UnknownAction,
  AnyActorScope,
  AnyState,
  EventObject,
  MachineContext,
  ParameterizedObject,
  SingleOrArray,
  NoInfer,
  ProvidedActor,
  ActionFunction
} from '../types.ts';
import { toArray } from '../utils.ts';
import { assign } from './assign.ts';
import { raise } from './raise.ts';
import { sendTo } from './send.ts';

function resolvePure(
  _: AnyActorScope,
  state: AnyState,
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
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: TParams): void;
  _out_TEvent?: TEvent;
  _out_TActor?: TActor;
  _out_TAction?: TAction;
  _out_TGuard?: TGuard;
  _out_TDelay?: TDelay;
}

export function pure<
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
  TParams,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TDelay
> {
  function pure(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
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

interface CreateActionExec {
  assign: (...args: Parameters<typeof assign<any, any, any, any, any>>) => void;
  raise: (...args: Parameters<typeof raise<any, any, any, any, any>>) => void;
  sendTo: (
    ...args: Parameters<typeof sendTo<any, any, any, any, any, any>>
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
      exec
    }: {
      context: MachineContext;
      event: EventObject;
      exec: CreateActionExec;
    }) => SingleOrArray<UnknownAction> | undefined;
  }
) {
  const actions: any[] = [];
  const exec: CreateActionExec = {
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
    }
  };
  get({ context: args.context, event: args.event, exec });
  return [state, undefined, actions];
}

export function createAction<
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
    exec
  }: {
    context: TContext;
    event: TExpressionEvent;
    exec: {
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
  TParams,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TDelay
> {
  function createAction(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  createAction.type = 'xstate.action';
  createAction.get = getActions;

  createAction.resolve = resolveCreateAction;

  return createAction;
}
