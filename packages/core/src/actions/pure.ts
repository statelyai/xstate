import { EventObject, SingleOrArray, MachineContext } from '../types';
import { pure as pureActionType } from '../actionTypes';
import { DynamicAction } from '../../actions/DynamicAction';
import {
  BaseActionObject,
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
): DynamicAction<
  TContext,
  TEvent,
  PureActionObject,
  DynamicPureActionObject<TContext, TEvent>['params']
> {
  return new DynamicAction(
    pureActionType,
    {
      get: getActions
    },
    (actions, ctx, _event) => {
      return {
        type: pureActionType,
        params: {
          actions: toArray(actions.params.get(ctx, _event.data)) ?? []
        }
      };
    }
  );
}
