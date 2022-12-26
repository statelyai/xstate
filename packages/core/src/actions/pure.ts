import { EventObject, SingleOrArray, MachineContext } from '../types';
import { pure as pureActionType } from '../actionTypes';
import { createDynamicAction } from '../../actions/dynamicAction';
import type {
  BaseActionObject,
  BaseDynamicActionObject,
  DynamicPureActionObject,
  PureActionObject
} from '../types';
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
    ({ params }, ctx, _event) => {
      return {
        type: pureActionType,
        params: {
          actions: toArray(params.get(ctx, _event.data)) ?? []
        }
      };
    }
  );
}
