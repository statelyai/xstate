import { EventObject, ChooseCondition, MachineContext } from '../types.js';
import * as actionTypes from '../actionTypes.js';
import { createDynamicAction } from '../../actions/dynamicAction.js';
import { evaluateGuard, toGuardDefinition } from '../guards.js';
import {
  BaseDynamicActionObject,
  ChooseAction,
  ResolvedChooseAction
} from '../index.js';
import { toActionObjects } from '../actions.js';

export function choose<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
>(
  guards: Array<ChooseCondition<TContext, TExpressionEvent>>
): BaseDynamicActionObject<
  TContext,
  TExpressionEvent,
  TEvent,
  ResolvedChooseAction,
  ChooseAction<TContext, TExpressionEvent>['params']
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
