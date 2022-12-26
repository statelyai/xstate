import {
  EventObject,
  LogExpr,
  MachineContext,
  LogActionObject
} from '../types';
import { log as logActionType } from '../actionTypes';
import { createDynamicAction } from '../../actions/dynamicAction';
import type { BaseDynamicActionObject, DynamicLogAction } from '../types';

const defaultLogExpr = <TContext, TEvent extends EventObject>(
  context: TContext,
  event: TEvent
) => ({
  context,
  event
});

/**
 *
 * @param expr The expression function to evaluate which will be logged.
 *  Takes in 2 arguments:
 *  - `ctx` - the current state context
 *  - `event` - the event that caused this action to be executed.
 * @param label The label to give to the logged expression.
 */

export function log<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  expr: string | LogExpr<TContext, TEvent> = defaultLogExpr,
  label?: string
): BaseDynamicActionObject<
  TContext,
  TEvent,
  LogActionObject,
  DynamicLogAction<TContext, TEvent>['params']
> {
  return createDynamicAction(
    logActionType,
    { label, expr },
    ({ type }, ctx, _event) => {
      return {
        type,
        params: {
          label,
          value:
            typeof expr === 'function'
              ? expr(ctx, _event.data, { _event })
              : expr
        }
      } as LogActionObject;
    }
  );
}
