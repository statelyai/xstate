import {
  Event,
  EventObject,
  SendActionParams,
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
import { createDynamicAction } from '../../actions/dynamicAction';
import {
  ActionTypes,
  AnyActorRef,
  BaseDynamicActionObject,
  Cast,
  EventFrom,
  ExprWithMeta,
  InferEvent,
  SendActionObject,
  SendActionOptions
} from '..';
import { actionTypes } from '../actions';

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
): BaseDynamicActionObject<
  TContext,
  TEvent,
  SendActionObject<AnyEventObject>,
  SendActionParams<TContext, TEvent>
> {
  const eventOrExpr = isFunction(event)
    ? event
    : toEventObject<TSentEvent>(event);

  return createDynamicAction<
    TContext,
    TEvent,
    SendActionObject<AnyEventObject>,
    SendActionParams<TContext, TEvent>
  >(
    sendActionType,
    {
      to: options ? options.to : undefined,
      delay: options ? options.delay : undefined,
      event: eventOrExpr,
      id:
        options && options.id !== undefined
          ? options.id
          : isFunction(event)
          ? event.name
          : (getEventType<TSentEvent>(event) as string)
    },
    ({ params }, ctx, _event, { machine }) => {
      const meta = {
        _event
      };
      const delaysMap = machine.options.delays;

      // TODO: helper function for resolving Expr
      const resolvedEvent = toSCXMLEvent(
        isFunction(eventOrExpr)
          ? eventOrExpr(ctx, _event.data, meta)
          : eventOrExpr
      );

      let resolvedDelay: number | undefined;
      if (isString(params.delay)) {
        const configDelay = delaysMap && delaysMap[params.delay];
        resolvedDelay = isFunction(configDelay)
          ? configDelay(ctx, _event.data, meta)
          : configDelay;
      } else {
        resolvedDelay = isFunction(params.delay)
          ? params.delay(ctx, _event.data, meta)
          : params.delay;
      }

      let resolvedTarget = isFunction(params.to)
        ? params.to(ctx, _event.data, meta)
        : params.to;
      resolvedTarget =
        isString(resolvedTarget) &&
        resolvedTarget !== SpecialTargets.Parent &&
        resolvedTarget !== SpecialTargets.Internal &&
        resolvedTarget.startsWith('#_')
          ? resolvedTarget.slice(2)
          : resolvedTarget;

      return {
        type: actionTypes.send,
        params: {
          id: '', // TODO: generate?
          ...params,
          to: resolvedTarget,
          _event: resolvedEvent,
          event: resolvedEvent.data,
          delay: resolvedDelay
        }
      };
    }
  );
}

/**
 * Sends an update event to this machine's parent.
 */
export function sendUpdate<
  TContext extends MachineContext,
  TEvent extends EventObject
>() {
  return sendParent<TContext, TEvent, { type: ActionTypes.Update }>(
    actionTypes.update
  );
}

/**
 * Sends an event to this machine's parent.
 *
 * @param event The event to send to the parent machine.
 * @param options Options to pass into the send event.
 */
export function sendParent<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
>(
  event: Event<TSentEvent> | SendExpr<TContext, TEvent, TSentEvent>,
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent, TSentEvent>(event, {
    ...options,
    to: SpecialTargets.Parent
  });
}

/**
 * Sends an event back to the sender of the original event.
 *
 * @param event The event to send back to the sender
 * @param options Options to pass into the send event
 */
export function respond<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
>(
  event: Event<TEvent> | SendExpr<TContext, TEvent, TSentEvent>,
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent>(event, {
    ...options,
    to: (_, __, { _event }) => {
      return _event.origin!; // TODO: handle when _event.origin is undefined
    }
  });
}

/**
 * Forwards (sends) an event to a specified service.
 *
 * @param target The target service to forward the event to.
 * @param options Options to pass into the send action creator.
 */
export function forwardTo<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  target: Required<SendActionParams<TContext, TEvent>>['to'],
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent>((_, event) => event, {
    ...options,
    to: target
  });
}

/**
 * Escalates an error by sending it as an event to this machine's parent.
 *
 * @param errorData The error data to send, or the expression function that
 * takes in the `context`, `event`, and `meta`, and returns the error data to send.
 * @param options Options to pass into the send action creator.
 */
export function escalate<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TErrorData = any
>(
  errorData: TErrorData | ExprWithMeta<TContext, TEvent, TErrorData>,
  options?: SendActionParams<TContext, TEvent>
) {
  return sendParent<TContext, TEvent>(
    (context, event, meta) => {
      return {
        type: actionTypes.error,
        data: isFunction(errorData)
          ? errorData(context, event, meta)
          : errorData
      };
    },
    {
      ...options,
      to: SpecialTargets.Parent
    }
  );
}

/**
 * Sends an event to an actor.
 *
 * @param actor The `ActorRef` to send the event to.
 * @param event The event to send, or an expression that evaluates to the event to send
 * @param options Send action options
 * @returns An XState send action object
 */
export function sendTo<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends AnyActorRef
>(
  actor: (ctx: TContext) => TActor,
  event:
    | EventFrom<TActor>
    | SendExpr<
        TContext,
        TEvent,
        InferEvent<Cast<EventFrom<TActor>, EventObject>>
      >,
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent, any>(event, {
    ...options,
    to: actor
  });
}
