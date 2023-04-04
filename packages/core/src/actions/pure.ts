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
    (_event, { state }) => {
      return [
        state,
        {
          type: pureActionType,
          params: {
            actions:
              toArray(
                toActionObjects(
                  getActions({ context: state.context, event: _event.data })
                )
              ) ?? []
          }
        }
      ];
    }
  );
}
