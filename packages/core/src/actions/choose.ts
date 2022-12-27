import { EventObject, ChooseCondition, MachineContext } from '../types';
import * as actionTypes from '../actionTypes';
import { createDynamicAction } from '../../actions/dynamicAction';
import { evaluateGuard, toGuardDefinition } from '../guards';
import {
  BaseDynamicActionObject,
  ChooseAction,
  ResolvedChooseAction
} from '..';
import { toActionObjects } from '../actions';

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
  return createDynamicAction(
    { type: actionTypes.choose, params: { guards } },
    (_event, { state }) => {
      const matchedActions = guards.find((condition) => {
        const guard =
          condition.guard &&
          toGuardDefinition(
            condition.guard,
            (guardType) => state.machine.options.guards[guardType]
          );
        return !guard || evaluateGuard(guard, state.context, _event, state);
      })?.actions;

      return [
        state,
        {
          type: actionTypes.choose,
          params: {
            actions: toActionObjects(matchedActions)
          }
        }
      ];
    }
  );
}
