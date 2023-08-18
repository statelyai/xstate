import isDevelopment from '#is-development';
import {
  EventObject,
  ChooseBranch,
  MachineContext,
  AnyActorContext,
  AnyState,
  ActionArgs,
  ParameterizedObject
} from '../types.ts';
import { evaluateGuard, toGuardDefinition } from '../guards.ts';
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
    const guard =
      condition.guard &&
      toGuardDefinition(
        condition.guard,
        (guardType) => state.machine.implementations.guards[guardType]
      );
    return (
      !guard || evaluateGuard(guard, state.context, actionArgs.event, state)
    );
  })?.actions;

  return [state, undefined, toArray(matchedActions)];
}

export function choose<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TAction extends ParameterizedObject
>(branches: Array<ChooseBranch<TContext, TExpressionEvent, TAction>>) {
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
  };
}
