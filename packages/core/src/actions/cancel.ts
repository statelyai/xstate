import { EventObject, ExprWithMeta, MachineContext } from '../types';
import { cancel as cancelActionType } from '../actionTypes';
import { isFunction } from '../utils';
import type {
  BaseDynamicActionObject,
  CancelActionObject,
  DynamicCancelActionObject
} from '../types';
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
    ({ params, type }, ctx, _event) => {
      const resolvedSendId = isFunction(params.sendId)
        ? params.sendId(ctx, _event.data, {
            _event
          })
        : params.sendId;

      return {
        type,
        params: {
          sendId: resolvedSendId
        }
      } as CancelActionObject;
    }
  );
}
