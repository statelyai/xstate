import { EventObject, SCXML, ExprWithMeta, MachineContext } from '../types';
import { cancel as cancelActionType } from '../actionTypes';
import { isFunction } from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';

/**
 * Cancels an in-flight `send(...)` action. A canceled sent action will not
 * be executed, nor will its event be sent, unless it has already been sent
 * (e.g., if `cancel(...)` is called after the `send(...)` action's `delay`).
 *
 * @param sendId The `id` of the `send(...)` action to cancel.
 */

export const cancel = <
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  sendId: string | ExprWithMeta<TContext, TEvent, string>
) => {
  const cancelAction = new DynamicAction(cancelActionType, {
    sendId
  });

  cancelAction.resolve = function (ctx: TContext, _event: SCXML.Event<TEvent>) {
    const sendId = isFunction(this.params.sendId)
      ? this.params.sendId(ctx, _event.data, {
          _event
        })
      : this.params.sendId;

    return {
      type: this.type,
      params: {
        sendId
      }
    };
  };

  return cancelAction;
};
