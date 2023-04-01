import {
  EventObject,
  LogExpr,
  MachineContext,
  LogActionObject
} from '../types.js';
import { log as logActionType } from '../actionTypes.js';
import { createDynamicAction } from '../../actions/dynamicAction.js';
import { BaseDynamicActionObject, DynamicLogAction } from '../index.js';

const defaultLogExpr = <TContext, TEvent extends EventObject>({
  context,
  event
}: {
  context: TContext;
  event: TEvent;
}) => ({
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
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  expr: string | LogExpr<TContext, TExpressionEvent> = defaultLogExpr,
  label?: string
): BaseDynamicActionObject<
  TContext,
  TExpressionEvent,
  TEvent,
  LogActionObject,
  DynamicLogAction<TContext, TExpressionEvent, TEvent>['params']
> {
  return createDynamicAction(
    { type: logActionType, params: { label, expr } },
    (_event, { state, actorContext }) => {
      const resolvedValue =
        typeof expr === 'function'
          ? expr({
              context: state.context,
              event: _event.data,
              meta: {
                _event,
                state: state as any,
                self: actorContext?.self ?? ({} as any),
                system: actorContext?.system
              }
            })
          : expr;
      return [
        state,
        {
          type: 'xstate.log',
          params: {
            label,
            value: resolvedValue
          },
          execute: (actorCtx) => {
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
