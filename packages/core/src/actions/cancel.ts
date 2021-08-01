import { EventObject, SCXML, ExprWithMeta, MachineContext } from '../types';
import { cancel as cancelActionType } from '../actionTypes';
import { isFunction } from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';
import { CancelActionObject } from '..';

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
): DynamicAction<TContext, TEvent, CancelActionObject> {
  const cancelAction = new DynamicAction<TContext, TEvent, CancelActionObject>(
    cancelActionType,
    {
      sendId
    },
    (action, ctx, _event) => {
      const resolvedSendId = isFunction(action.params.sendId)
        ? action.params.sendId(ctx, _event.data, {
            _event
          })
        : action.params.sendId;

      return {
        type: action.type,
        params: {
          sendId: resolvedSendId
        }
      } as CancelActionObject;
    }
  );

  return cancelAction;
}
