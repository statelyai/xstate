import isDevelopment from '#is-development';
import {
  EventObject,
  ChooseBranch,
  MachineContext,
  AnyActorContext,
  AnyState,
  ActionArgs,
  ParameterizedObject,
  NoInfer,
  ProvidedActor
} from '../types.ts';
import { evaluateGuard } from '../guards.ts';
import { toArray } from '../utils.ts';

function resolveChoose(
  _: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any, any, any>,
  {
    branches
  }: {
    branches: Array<
      ChooseBranch<
        MachineContext,
        EventObject,
        EventObject,
        ProvidedActor,
        ParameterizedObject,
        ParameterizedObject,
        string
      >
    >;
  }
) {
  const matchedActions = branches.find((condition) => {
    return (
      !condition.guard ||
      evaluateGuard(condition.guard, state.context, actionArgs.event, state)
    );
  })?.actions;

  return [state, undefined, toArray(matchedActions)];
}

export interface ChooseAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> {
  (_: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>): void;
  _out_TActor?: TActor;
  _out_TAction?: TAction;
  _out_TGuard?: TGuard;
  _out_TDelay?: TDelay;
}

export function choose<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
>(
  branches: ReadonlyArray<
    ChooseBranch<
      TContext,
      TExpressionEvent,
      TEvent,
      TActor,
      NoInfer<TAction>,
      NoInfer<TGuard>,
      TDelay
    >
  >
): ChooseAction<
  TContext,
  TExpressionEvent,
  TExpressionAction,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TDelay
> {
  function choose(
    _: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  choose.type = 'xstate.choose';
  choose.branches = branches;

  choose.resolve = resolveChoose;

  return choose;
}
