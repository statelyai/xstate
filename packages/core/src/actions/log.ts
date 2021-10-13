import {
  EventObject,
  LogExpr,
  MachineContext,
  LogActionObject
} from '../types';
import { log as logActionType } from '../actionTypes';
import { isString } from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';
import { DynamicLogAction } from '..';

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
): DynamicAction<
  TContext,
  TEvent,
  LogActionObject,
  DynamicLogAction<TContext, TEvent>['params']
> {
  return new DynamicAction(
    logActionType,
    { label, expr },
    (action, ctx, _event) => {
      return {
        type: action.type,
        params: {
          label,
          value: typeof expr === 'function' ? expr(ctx, _event.data, { _event }) : expr
        }
      } as LogActionObject;
    }
  );
}
