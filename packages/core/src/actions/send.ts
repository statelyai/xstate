import isDevelopment from '#is-development';
import {
  EventObject,
  SendActionParams,
  SpecialTargets,
  SendExpr,
  AnyEventObject,
  MachineContext
} from '../types.ts';
import { send as sendActionType } from '../actionTypes.ts';
import { isFunction, isString } from '../utils.ts';
import { createDynamicAction } from '../../actions/dynamicAction.ts';
import {
  AnyActorRef,
  AnyInterpreter,
  BaseDynamicActionObject,
  Cast,
  EventFrom,
  ExprWithMeta,
  InferEvent,
  SendActionObject,
  SendActionOptions,
  StateMeta,
  UnifiedArg
} from '../index.ts';
import { actionTypes, error } from '../actions.ts';

/**
 * Sends an event. This returns an action that will be read by an interpreter to
 * send the event in the next step, after the current step is finished executing.
 *
 * @deprecated Use the `sendTo(...)` action creator instead.
 *
 * @param eventOrExpr The event to send.
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
  eventOrExpr: TSentEvent | SendExpr<TContext, TEvent, AnyEventObject>,
  options?: SendActionOptions<TContext, TEvent>
): BaseDynamicActionObject<
  TContext,
  TEvent,
  TEvent,
  SendActionObject<AnyEventObject>,
  SendActionParams<TContext, TEvent>
> {
  return createDynamicAction<
    TContext,
    TEvent,
    TEvent,
    SendActionObject<AnyEventObject>,
    SendActionParams<TContext, TEvent>
  >(
    {
      type: sendActionType,
      params: {
        to: options ? options.to : undefined,
        delay: options ? options.delay : undefined,
        event: eventOrExpr,
        id:
          options && options.id !== undefined
            ? options.id
            : isFunction(eventOrExpr)
            ? eventOrExpr.name
            : eventOrExpr.type
      }
    },
    (event, { actorContext, state }) => {
      const params = {
        to: options ? options.to : undefined,
        delay: options ? options.delay : undefined,
        event: eventOrExpr,
        // TODO: don't auto-generate IDs here like that
        // there is too big chance of the ID collision
        id:
          options && options.id !== undefined
            ? options.id
            : isFunction(eventOrExpr)
            ? eventOrExpr.name
            : eventOrExpr.type
      };
      const args: UnifiedArg<TContext, TEvent> & StateMeta<TEvent> = {
        context: state.context,
        event,
        self: actorContext?.self ?? (null as any),
        system: actorContext?.system
      };
      const delaysMap = state.machine.options.delays;

      // TODO: helper function for resolving Expr
      if (typeof eventOrExpr === 'string') {
        throw new Error(
          `Only event objects may be used with sendTo; use sendTo({ type: "${eventOrExpr}" }) instead`
        );
      }
      const resolvedEvent = isFunction(eventOrExpr)
        ? eventOrExpr(args)
        : eventOrExpr;

      let resolvedDelay: number | undefined;
      if (isString(params.delay)) {
        const configDelay = delaysMap && delaysMap[params.delay];
        resolvedDelay = isFunction(configDelay)
          ? configDelay(args)
          : configDelay;
      } else {
        resolvedDelay = isFunction(params.delay)
          ? params.delay(args)
          : params.delay;
      }

      const resolvedTarget = isFunction(params.to)
        ? params.to(args)
        : params.to;
      let targetActorRef: AnyActorRef | undefined;

      if (typeof resolvedTarget === 'string') {
        if (resolvedTarget === SpecialTargets.Parent) {
          targetActorRef = actorContext?.self._parent;
        } else if (resolvedTarget === SpecialTargets.Internal) {
          targetActorRef = actorContext?.self;
        } else if (resolvedTarget.startsWith('#_')) {
          // SCXML compatibility: https://www.w3.org/TR/scxml/#SCXMLEventProcessor
          // #_invokeid. If the target is the special term '#_invokeid', where invokeid is the invokeid of an SCXML session that the sending session has created by <invoke>, the Processor must add the event to the external queue of that session.
          targetActorRef = state.children[resolvedTarget.slice(2)];
        } else {
          targetActorRef = state.children[resolvedTarget];
        }
        if (!targetActorRef) {
          throw new Error(
            `Unable to send event to actor '${resolvedTarget}' from machine '${state.machine.id}'.`
          );
        }
      } else {
        targetActorRef = resolvedTarget || actorContext?.self;
      }

      const resolvedAction: SendActionObject = {
        type: actionTypes.send,
        params: {
          ...params,
          to: targetActorRef,
          event: resolvedEvent,
          delay: resolvedDelay,
          internal: resolvedTarget === SpecialTargets.Internal
        },
        execute: (actorCtx) => {
          const sendAction = resolvedAction as SendActionObject;

          if (typeof sendAction.params.delay === 'number') {
            (actorCtx.self as AnyInterpreter).delaySend(sendAction);
            return;
          } else {
            const target = sendAction.params.to!;
            const sentEvent = sendAction.params.event;
            actorCtx.defer(() => {
              target.send(
                sentEvent.type === actionTypes.error
                  ? {
                      type: `${error(actorCtx.self.id)}`,
                      data: sentEvent.data
                    }
                  : sendAction.params.event
              );
            });
          }
        }
      };

      return [state, resolvedAction];
    }
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
  event: TSentEvent | SendExpr<TContext, TEvent, TSentEvent>,
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent, TSentEvent>(event, {
    ...options,
    to: SpecialTargets.Parent
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
  if (isDevelopment && (!target || typeof target === 'function')) {
    const originalTarget = target;
    target = (...args) => {
      const resolvedTarget =
        typeof originalTarget === 'function'
          ? originalTarget(...args)
          : originalTarget;
      if (!resolvedTarget) {
        throw new Error(
          `Attempted to forward event to undefined actor. This risks an infinite loop in the sender.`
        );
      }
      return resolvedTarget;
    };
  }
  return send<TContext, TEvent>(({ event }) => event, {
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
    (arg) => {
      return {
        type: actionTypes.error,
        data: isFunction(errorData) ? errorData(arg) : errorData
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
  actor: TActor | string | ExprWithMeta<TContext, TEvent, TActor | string>,
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
