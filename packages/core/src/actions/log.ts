import {
  EventObject,
  LogExpr,
  MachineContext,
  LogActionObject
} from '../types';
import { log as logActionType } from '../actionTypes';
import { isString } from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';
import { defaultLogExpr } from '../actions';

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
): DynamicAction<TContext, TEvent, LogActionObject> {
  const logAction = new DynamicAction<TContext, TEvent, LogActionObject>(
    logActionType,
    { label, expr }
  );

  logAction.resolve = function (ctx, _event) {
    return {
      type: this.type,
      params: {
        label,
        value: isString(expr) ? expr : expr(ctx, _event.data, { _event })
      }
    };
  };

  return logAction;
}
