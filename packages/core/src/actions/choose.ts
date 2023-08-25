import isDevelopment from '#is-development';
import {
  EventObject,
  ChooseBranch,
  MachineContext,
  AnyActorContext,
  AnyState,
  ActionArgs,
  ParameterizedObject,
  NoInfer
} from '../types.ts';
import { evaluateGuard } from '../guards.ts';
import { toArray } from '../utils.ts';

function resolve(
  _: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any, any>,
  {
    branches
  }: {
    branches: Array<ChooseBranch<MachineContext, EventObject>>;
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

export function choose<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject
>(
  branches: ReadonlyArray<
    ChooseBranch<
      TContext,
      TExpressionEvent,
      TEvent,
      NoInfer<TAction>,
      NoInfer<TGuard>
    >
  >
) {
  function choose(
    _: ActionArgs<TContext, TExpressionEvent, TExpressionAction>
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  choose.type = 'xstate.choose';
  choose.branches = branches;

  choose.resolve = resolve;

  return choose as {
    (args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>): void;
    _out_TAction?: TAction;
    _out_TGuard?: TGuard;
  };
}
