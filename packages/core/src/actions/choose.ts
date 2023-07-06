import isDevelopment from '#is-development';
import {
  EventObject,
  ChooseCondition,
  MachineContext,
  AnyActorContext,
  AnyState,
  ActionArgs
} from '../types.ts';
import { evaluateGuard, toGuardDefinition } from '../guards.ts';
import { toArray } from '../utils.ts';

function resolve(
  _: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any>,
  {
    branches
  }: {
    branches: Array<ChooseCondition<MachineContext, EventObject>>;
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
  TEvent extends EventObject
>(branches: Array<ChooseCondition<TContext, TExpressionEvent>>) {
  function choose(_: ActionArgs<TContext, TExpressionEvent>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  choose.branches = branches;

  choose.resolve = resolve;

  return choose;
}
