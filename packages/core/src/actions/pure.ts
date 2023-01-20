import { EventObject, SingleOrArray, MachineContext } from '../types.js';
import { pure as pureActionType } from '../actionTypes.js';
import { createDynamicAction } from '../../actions/dynamicAction.js';
import {
  BaseActionObject,
  BaseDynamicActionObject,
  DynamicPureActionObject,
  PureActionObject
} from '..';
import { toArray } from '../utils.js';
import { toActionObjects } from '../actions.js';

export function pure<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  getActions: (
    context: TContext,
    event: TEvent
  ) => SingleOrArray<BaseActionObject | string> | undefined
): BaseDynamicActionObject<
  TContext,
  TEvent,
  PureActionObject,
  DynamicPureActionObject<TContext, TEvent>['params']
> {
  return createDynamicAction(
    {
      type: pureActionType,
      params: {
        get: getActions
      }
    },
    (_event, { state }) => {
      return [
        state,
        {
          type: pureActionType,
          params: {
            actions:
              toArray(
                toActionObjects(getActions(state.context, _event.data))
              ) ?? []
          }
        }
      ];
    }
  );
}
