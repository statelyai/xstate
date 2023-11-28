import isDevelopment from '#is-development';
import {
  ActionArgs,
  Actions,
  AnyActorScope,
  AnyMachineSnapshot,
  EventObject,
  MachineContext,
  NoInfer,
  ParameterizedObject,
  ProvidedActor,
  SingleOrArray,
  UnknownAction
} from '../types.ts';
import { toArray } from '../utils.ts';

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
 * @deprecated Use `enqueueActions(...)` instead
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
