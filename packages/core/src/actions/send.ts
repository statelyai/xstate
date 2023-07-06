import isDevelopment from '#is-development';
import {
  EventObject,
  SendToActionParams,
  SpecialTargets,
  SendExpr,
  AnyEventObject,
  MachineContext
} from '../types.ts';
import {
  ActorRef,
  AnyActorContext,
  AnyActorRef,
  AnyInterpreter,
  AnyState,
  Cast,
  DelayExpr,
  EventFrom,
  InferEvent,
  SendToActionOptions,
  UnifiedArg
} from '../index.ts';
import { actionTypes, error } from '../actions.ts';
import { BuiltinAction } from './_shared.ts';

class SendToResolver<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends BuiltinAction<TContext, TExpressionEvent, TEvent> {
  static to:
    | AnyActorRef
    | string
    | ((args: UnifiedArg<MachineContext, EventObject>) => AnyActorRef | string);
  static event:
    | EventObject
    | SendExpr<MachineContext, EventObject, EventObject>;
  static id: string | undefined;
  static delay:
    | string
    | number
    | DelayExpr<MachineContext, EventObject>
    | undefined;

  static resolve(
    actorContext: AnyActorContext,
    state: AnyState,
    args: UnifiedArg<any, any>
  ) {
    const { to, event: eventOrExpr, id, delay } = this;
    const delaysMap = state.machine.implementations.delays;

    if (typeof eventOrExpr === 'string') {
      throw new Error(
        `Only event objects may be used with sendTo; use sendTo({ type: "${eventOrExpr}" }) instead`
      );
    }
    const resolvedEvent =
      typeof eventOrExpr === 'function' ? eventOrExpr(args) : eventOrExpr;

    let resolvedDelay: number | undefined;
    if (typeof delay === 'string') {
      const configDelay = delaysMap && delaysMap[delay];
      resolvedDelay =
        typeof configDelay === 'function' ? configDelay(args) : configDelay;
    } else {
      resolvedDelay = typeof delay === 'function' ? delay(args) : delay;
    }

    const resolvedTarget = typeof to === 'function' ? to(args) : to;
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

    return [
      state,
      { to: targetActorRef, event: resolvedEvent, id, delay: resolvedDelay }
    ];
  }
  static execute(
    actorContext: AnyActorContext,
    params: {
      to: AnyActorRef;
      event: EventObject;
      id: string | undefined;
      delay: number | undefined;
    }
  ) {
    if (typeof params.delay === 'number') {
      (actorContext.self as AnyInterpreter).delaySend(
        params as typeof params & { delay: number }
      );
      return;
    }

    const { to, event } = params;

    actorContext.defer(() => {
      to.send(
        event.type === actionTypes.error
          ? {
              type: `${error(actorContext.self.id)}`,
              data: (event as any).data
            }
          : event
      );
    });
  }
}

/**
 * Sends an event to an actor.
 *
 * @param actor The `ActorRef` to send the event to.
 * @param event The event to send, or an expression that evaluates to the event to send
 * @param options Send action options
 *  - `id` - The unique send event identifier (used with `cancel()`).
 *  - `delay` - The number of milliseconds to delay the sending of the event.
 */
export function sendTo<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends AnyActorRef
>(
  to:
    | TActor
    | string
    | ((args: UnifiedArg<TContext, TExpressionEvent>) => TActor | string),
  eventOrExpr:
    | EventFrom<TActor>
    | SendExpr<
        TContext,
        TExpressionEvent,
        InferEvent<Cast<EventFrom<TActor>, EventObject>>
      >,
  options?: SendToActionOptions<TContext, TExpressionEvent>
) {
  return class SendTo extends SendToResolver<
    TContext,
    TExpressionEvent,
    TEvent
  > {
    static to = to as any;
    static event = eventOrExpr as any;
    static id = options?.id;
    static delay = options?.delay as any;
  };
}

/**
 * Sends an event to this machine's parent.
 *
 * @param event The event to send to the parent machine.
 * @param options Options to pass into the send event.
 */
export function sendParent<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
>(
  event: TSentEvent | SendExpr<TContext, TExpressionEvent, TSentEvent>,
  options?: SendToActionOptions<TContext, TExpressionEvent>
) {
  return sendTo<TContext, TExpressionEvent, TEvent, AnyActorRef>(
    SpecialTargets.Parent,
    event,
    options
  );
}

type Target<TContext extends MachineContext, TEvent extends EventObject> =
  | string
  | ActorRef<any, any>
  | ((args: UnifiedArg<TContext, TEvent>) => string | ActorRef<any, any>);

/**
 * Forwards (sends) an event to a specified service.
 *
 * @param target The target service to forward the event to.
 * @param options Options to pass into the send action creator.
 */
export function forwardTo<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
>(
  target: Target<TContext, TExpressionEvent>,
  options?: SendToActionOptions<TContext, TExpressionEvent>
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
  return sendTo<TContext, TExpressionEvent, EventObject, AnyActorRef>(
    target,
    ({ event }: any) => event,
    options
  );
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
  TExpressionEvent extends EventObject,
  TErrorData = any
>(
  errorData:
    | TErrorData
    | ((args: UnifiedArg<TContext, TExpressionEvent>) => TErrorData),
  options?: SendToActionParams<TContext, TExpressionEvent>
) {
  return sendParent<TContext, TExpressionEvent, EventObject>((arg) => {
    return {
      type: actionTypes.error,
      data:
        typeof errorData === 'function' ? (errorData as any)(arg) : errorData
    };
  }, options);
}
