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
    actionTypes.choose,
    { guards },
    ({ params }, _event, { machine, state }) => {
      const matchedActions = params.guards.find((condition) => {
        const guard =
          condition.guard &&
          toGuardDefinition(
            condition.guard,
            (guardType) => machine.options.guards[guardType]
          );
        return !guard || evaluateGuard(guard, state.context, _event, state);
      })?.actions;

      return {
        type: actionTypes.choose,
        params: {
          actions: toActionObjects(matchedActions)
        }
      };
    }
  );
}
