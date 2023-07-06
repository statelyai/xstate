import {
  EventObject,
  ChooseCondition,
  MachineContext,
  AnyActorContext,
  AnyState,
  UnifiedArg
} from '../types.ts';
import { evaluateGuard, toGuardDefinition } from '../guards.ts';
import { BuiltinAction } from './_shared.ts';
import { toArray } from '../utils.ts';

class ChooseResolver<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends BuiltinAction<TContext, TExpressionEvent, TEvent> {
  static branches: Array<ChooseCondition<MachineContext, EventObject>>;

  static resolve(
    _: AnyActorContext,
    state: AnyState,
    args: UnifiedArg<any, any>
  ) {
    const { branches } = this;
    const matchedActions = branches.find((condition) => {
      const guard =
        condition.guard &&
        toGuardDefinition(
          condition.guard,
          (guardType) => state.machine.implementations.guards[guardType]
        );
      return !guard || evaluateGuard(guard, state.context, args.event, state);
    })?.actions;

    return [state, undefined, toArray(matchedActions)];
  }
}

export function choose<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
>(branches: Array<ChooseCondition<TContext, TExpressionEvent>>) {
  return class Choose extends ChooseResolver<
    TContext,
    TExpressionEvent,
    TEvent
  > {
    static branches = branches as any;
  };
}
