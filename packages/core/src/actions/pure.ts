import { EventObject, SingleOrArray, MachineContext } from '../types';
import { pure as pureActionType } from '../actionTypes';
import { DynamicAction } from '../../actions/DynamicAction';
import { BaseActionObject, PureActionObject } from '..';

export function pure<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  getActions: (
    context: TContext,
    event: TEvent
  ) => SingleOrArray<BaseActionObject> | undefined
): DynamicAction<TContext, TEvent, PureActionObject> {
  return new DynamicAction(
    pureActionType,
    {
      get: getActions
    },
    (actions, ctx, _event) => {
      return {
        type: pureActionType,
        params: {
          actions: actions.params.get(ctx, _event.data)
        }
      };
    }
  );
}
