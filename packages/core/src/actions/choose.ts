import { EventObject, ChooseCondition, MachineContext } from '../types';
import * as actionTypes from '../actionTypes';
import { toArray } from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';
import { evaluateGuard, toGuardDefinition } from '../guards';
import {
  BaseDynamicActionObject,
  ChooseAction,
  ResolvedChooseAction
} from '..';
import { toActionObject } from '../actions';

export function choose<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  guards: Array<ChooseCondition<TContext, TEvent>>
): BaseDynamicActionObject<
  TContext,
  TEvent,
  ResolvedChooseAction,
  ChooseAction<TContext, TEvent>['params']
> {
  return new DynamicAction(
    actionTypes.choose,
    { guards },
    (action, context, _event, { machine, state }) => {
      const matchedActions = action.params.guards.find((condition) => {
        const guard =
          condition.guard &&
          toGuardDefinition(
            condition.guard,
            (guardType) => machine.options.guards[guardType]
          );
        return !guard || evaluateGuard(guard, context, _event, state, machine);
      })?.actions;

      return {
        type: actionTypes.choose,
        params: {
          actions: toArray(matchedActions).map((chosenAction) =>
            toActionObject(chosenAction)
          )
        }
      };
    }
  );
}
