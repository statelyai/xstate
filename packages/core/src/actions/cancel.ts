import { EventObject, ExprWithMeta, MachineContext } from '../types.ts';
import { cancel as cancelActionType } from '../actionTypes.ts';
import { isFunction } from '../utils.ts';
import {
  AnyInterpreter,
  BaseDynamicActionObject,
  CancelActionObject,
  DynamicCancelActionObject
} from '../index.ts';
import { createDynamicAction } from '../../actions/dynamicAction.ts';

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
    (event, { state, actorContext }) => {
      const resolvedSendId = isFunction(sendId)
        ? sendId({
            context: state.context,
            event,
            self: actorContext?.self ?? ({} as any),
            system: actorContext?.system
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
