import { EventObject, ExprWithMeta, MachineContext } from '../types';
import { cancel as cancelActionType } from '../actionTypes';
import { isFunction } from '../utils';
import {
  AnyInterpreter,
  BaseDynamicActionObject,
  CancelActionObject,
  DynamicCancelActionObject
} from '..';
import { createDynamicAction } from '../../actions/dynamicAction';

/**
 * Cancels an in-flight `send(...)` action. A canceled sent action will not
 * be executed, nor will its event be sent, unless it has already been sent
 * (e.g., if `cancel(...)` is called after the `send(...)` action's `delay`).
 *
 * @param sendId The `id` of the `send(...)` action to cancel.
 */

export function cancel<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  sendId: string | ExprWithMeta<TContext, TEvent, string>
): BaseDynamicActionObject<
  TContext,
  TEvent,
  CancelActionObject,
  DynamicCancelActionObject<TContext, TEvent>['params']
> {
  return createDynamicAction(
    cancelActionType,
    {
      sendId
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
          execute2: (actorCtx) => {
            const interpreter = actorCtx.self as AnyInterpreter;

            interpreter.cancel(resolvedSendId);
          }
        } as CancelActionObject
      ];
    }
  );
}
