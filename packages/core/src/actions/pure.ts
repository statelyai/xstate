import { EventObject, SingleOrArray, MachineContext } from '../types';
import { pure as pureActionType } from '../actionTypes';
import { createDynamicAction } from '../../actions/dynamicAction';
import {
  BaseActionObject,
  BaseDynamicActionObject,
  DynamicPureActionObject,
  PureActionObject
} from '..';
import { toArray } from '../utils';
import { toActionObjects } from '../actions';

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
