import isDevelopment from '#is-development';
import {
  Actions,
  ActionArgs,
  UnknownAction,
  AnyActorContext,
  AnyState,
  EventObject,
  MachineContext,
  ParameterizedObject,
  SingleOrArray,
  NoInfer
} from '../types.ts';
import { toArray } from '../utils.ts';

function resolve(
  _: AnyActorContext,
  state: AnyState,
  args: ActionArgs<any, any, any>,
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

export function pure<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent,
  TExpressionAction extends ParameterizedObject | undefined =
    | ParameterizedObject
    | undefined,
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
        NoInfer<TAction>,
        NoInfer<TGuard>,
        TDelay
      >
    | undefined
) {
  function pure(_: ActionArgs<TContext, TExpressionEvent, TExpressionAction>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  pure.type = 'xstate.pure';
  pure.get = getActions;
  pure.resolve = resolve;

  return pure as {
    (args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>): void;
    _out_TEvent?: TEvent;
    _out_TAction?: TAction;
    _out_TGuard?: TGuard;
    _out_TDelay?: TDelay;
  };
}
