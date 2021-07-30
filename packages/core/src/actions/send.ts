import {
  Event,
  EventObject,
  SendActionOptions,
  SpecialTargets,
  SendExpr,
  AnyEventObject,
  MachineContext
} from '../types';
import { send as sendActionType } from '../actionTypes';
import {
  getEventType,
  isFunction,
  isString,
  toEventObject,
  toSCXMLEvent
} from '../utils';
import { DynamicAction } from '../../actions/DynamicAction';
import { SendActionObject } from '..';

/**
 * Sends an event. This returns an action that will be read by an interpreter to
 * send the event in the next step, after the current step is finished executing.
 *
 * @param event The event to send.
 * @param options Options to pass into the send event:
 *  - `id` - The unique send event identifier (used with `cancel()`).
 *  - `delay` - The number of milliseconds to delay the sending of the event.
 *  - `to` - The target of this event (by default, the machine the event was sent from).
 */

export function send<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
>(
  event: Event<TSentEvent> | SendExpr<TContext, TEvent, TSentEvent>,
  options?: SendActionOptions<TContext, TEvent>
) {
  const sendAction = new DynamicAction<
    TContext,
    TEvent,
    SendActionObject<TContext, TEvent>
  >(sendActionType, {
    to: options ? options.to : undefined,
    event: isFunction(event) ? event : toEventObject<TSentEvent>(event),
    delay: options ? options.delay : undefined,
    id:
      options && options.id !== undefined
        ? options.id
        : isFunction(event)
        ? event.name
        : (getEventType<TSentEvent>(event) as string)
  });

  sendAction.resolve = function (ctx, _event, { machine }) {
    const meta = {
      _event
    };
    const delaysMap = machine.options.delays;

    // TODO: helper function for resolving Expr
    const resolvedEvent = toSCXMLEvent(
      isFunction(this.params.event)
        ? this.params.event(ctx, _event.data, meta)
        : this.params.event
    );

    let resolvedDelay: number | undefined;
    if (isString(this.params.delay)) {
      const configDelay = delaysMap && delaysMap[this.params.delay];
      resolvedDelay = isFunction(configDelay)
        ? configDelay(ctx, _event.data, meta)
        : configDelay;
    } else {
      resolvedDelay = isFunction(this.params.delay)
        ? this.params.delay(ctx, _event.data, meta)
        : this.params.delay;
    }

    let resolvedTarget = isFunction(this.params.to)
      ? this.params.to(ctx, _event.data, meta)
      : this.params.to;
    resolvedTarget =
      isString(resolvedTarget) &&
      resolvedTarget !== SpecialTargets.Parent &&
      resolvedTarget !== SpecialTargets.Internal &&
      resolvedTarget.startsWith('#_')
        ? resolvedTarget.slice(2)
        : resolvedTarget;

    return {
      type: this.type,
      params: {
        ...this.params,
        to: resolvedTarget,
        _event: resolvedEvent,
        event: resolvedEvent.data,
        delay: resolvedDelay
      }
    };
  };

  return sendAction;
}
