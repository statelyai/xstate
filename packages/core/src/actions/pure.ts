import { EventObject, SingleOrArray, MachineContext } from '../types.js';
import { pure as pureActionType } from '../actionTypes.js';
import { createDynamicAction } from '../../actions/dynamicAction.js';
import {
  BaseActionObject,
  BaseDynamicActionObject,
  DynamicPureActionObject,
  PureActionObject
} from '../index.js';
import { toArray } from '../utils.js';

export function pure<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  getActions: (
    context: TContext,
    event: TEvent
  ) => SingleOrArray<BaseActionObject> | undefined
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
            actions: toArray(getActions(state.context, _event.data)) ?? []
          }
        }
      ];
    }
  );
}
