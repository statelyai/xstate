import { EventObject, ExprWithMeta, MachineContext } from '../types.js';
import { cancel as cancelActionType } from '../actionTypes.js';
import { isFunction } from '../utils.js';
import {
  AnyInterpreter,
  BaseDynamicActionObject,
  CancelActionObject,
  DynamicCancelActionObject
} from '../index.js';
import { createDynamicAction } from '../../actions/dynamicAction.js';

/**
 * Cancels an in-flight `send(...)` action. A canceled sent action will not
 * be executed, nor will its event be sent, unless it has already been sent
 * (e.g., if `cancel(...)` is called after the `send(...)` action's `delay`).
 *
 * @param sendId The `id` of the `send(...)` action to cancel.
 */

export function cancel<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
>(
  sendId: string | ExprWithMeta<TContext, TExpressionEvent, string>
): BaseDynamicActionObject<
  TContext,
  TExpressionEvent,
  TEvent,
  CancelActionObject,
  DynamicCancelActionObject<TContext, TExpressionEvent>['params']
> {
  return createDynamicAction(
    {
      type: cancelActionType,
      params: {
        sendId
      }
    },
    (_event, { state }) => {
      const resolvedSendId = isFunction(sendId)
        ? sendId(state.context, _event.data, {
            _event
          })
        : sendId;

      return [
        state,
        {
          type: 'xstate.cancel',
          params: {
            sendId: resolvedSendId
          },
          execute: (actorCtx) => {
            const interpreter = actorCtx.self as AnyInterpreter;

            interpreter.cancel(resolvedSendId);
          }
        } as CancelActionObject
      ];
    }
  );
}