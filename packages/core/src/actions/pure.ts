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
    pureActionType,
    {
      get: getActions
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
