import { EventObject, SingleOrArray, MachineContext } from '../types.ts';
import { pure as pureActionType } from '../actionTypes.ts';
import { createDynamicAction } from '../../actions/dynamicAction.ts';
import {
  BaseActionObject,
  BaseDynamicActionObject,
  DynamicPureActionObject,
  PureActionObject
} from '..';
import { toArray } from '../utils.ts';
import { toActionObjects } from '../actions.ts';

export function pure<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  getActions: ({
    context,
    event
  }: {
    context: TContext;
    event: TExpressionEvent;
  }) => SingleOrArray<BaseActionObject | string> | undefined
): BaseDynamicActionObject<
  TContext,
  TExpressionEvent,
  TEvent,
  PureActionObject,
  DynamicPureActionObject<TContext, TExpressionEvent>['params']
> {
  return createDynamicAction(
    {
      type: pureActionType,
      params: {
        get: getActions
      }
    },
    (event, { state }) => {
      return [
        state,
        {
          type: pureActionType,
          params: {
            actions:
              toArray(
                toActionObjects(getActions({ context: state.context, event }))
              ) ?? []
          }
        }
      ];
    }
  );
}
