import {
  EventObject,
  LogExpr,
  MachineContext,
  LogActionObject
} from '../types';
import { log as logActionType } from '../actionTypes';
import { createDynamicAction } from '../../actions/dynamicAction';
import { BaseDynamicActionObject, DynamicLogAction } from '..';

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
    (_event, { state }) => {
      const resolvedValue =
        typeof expr === 'function'
          ? expr(state.context, _event.data, { _event })
          : expr;
      return [
        state,
        {
          type: 'xstate.log',
          params: {
            label,
            value: resolvedValue
          },
          execute2: (actorCtx) => {
            if (label) {
              actorCtx.logger?.(label, resolvedValue);
            } else {
              actorCtx.logger?.(resolvedValue);
            }
          }
        } as LogActionObject
      ];
    }
  );
}
