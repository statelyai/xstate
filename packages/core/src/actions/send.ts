import isDevelopment from '#is-development';
import { createErrorPlatformEvent } from '../eventUtils.ts';
import {
  ActionArgs,
  ActorRef,
  AnyActorContext,
  AnyActorRef,
  AnyEventObject,
  AnyActor,
  AnyState,
  Cast,
  DelayExpr,
  EventFrom,
  EventObject,
  InferEvent,
  MachineContext,
  SendExpr,
  SendToActionOptions,
  SendToActionParams,
  SpecialTargets,
  UnifiedArg,
  ParameterizedObject,
  NoInfer
} from '../types.ts';
import { XSTATE_ERROR } from '../constants.ts';

function resolve(
  actorContext: AnyActorContext,
  state: AnyState,
  args: ActionArgs<any, any, any>,
  {
    to,
    event: eventOrExpr,
    id,
    delay
  }: {
    to:
      | AnyActorRef
      | string
      | ((
          args: UnifiedArg<MachineContext, EventObject>
        ) => AnyActorRef | string);
    event:
      | EventObject
      | SendExpr<
          MachineContext,
          EventObject,
          ParameterizedObject | undefined,
          EventObject
        >;
    id: string | undefined;
    delay:
      | string
      | number
      | DelayExpr<MachineContext, EventObject, ParameterizedObject | undefined>
      | undefined;
  }
) {
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
function execute(
  actorContext: AnyActorContext,
  params: {
    to: AnyActorRef;
    event: EventObject;
    id: string | undefined;
    delay: number | undefined;
  }
) {
  if (typeof params.delay === 'number') {
    (actorContext.self as AnyActor).delaySend(
      params as typeof params & { delay: number }
    );
    return;
  }

  const { to, event } = params;

  actorContext.defer(() => {
    actorContext?.system.sendTo(
      to,
      event.type === XSTATE_ERROR
        ? createErrorPlatformEvent(actorContext.self.id, (event as any).data)
        : event,
      actorContext.self
    );
  });
}

export interface SendToAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TDelay extends string
> {
  (_: ActionArgs<TContext, TExpressionEvent, TExpressionAction>): void;
  _out_TDelay?: TDelay;
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
  TExpressionAction extends ParameterizedObject | undefined,
  TActor extends AnyActorRef,
  TDelay extends string
>(
  to:
    | TActor
    | string
    | ((
        args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>
      ) => TActor | string),
  eventOrExpr:
    | EventFrom<TActor>
    | SendExpr<
        TContext,
        TExpressionEvent,
        TExpressionAction,
        InferEvent<Cast<EventFrom<TActor>, EventObject>>
      >,
  options?: SendToActionOptions<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    NoInfer<TDelay>
  >
): SendToAction<TContext, TExpressionEvent, TExpressionAction, TDelay> {
  function sendTo(
    _: ActionArgs<TContext, TExpressionEvent, TExpressionAction>
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  sendTo.type = 'xstate.sendTo';
  sendTo.to = to;
  sendTo.event = eventOrExpr;
  sendTo.id = options?.id;
  sendTo.delay = options?.delay;

  sendTo.resolve = resolve;
  sendTo.execute = execute;

  return sendTo;
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
  TExpressionAction extends ParameterizedObject | undefined,
  TSentEvent extends EventObject = AnyEventObject,
  TDelay extends string = string
>(
  event:
    | TSentEvent
    | SendExpr<TContext, TExpressionEvent, TExpressionAction, TSentEvent>,
  options?: SendToActionOptions<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TDelay
  >
) {
  return sendTo<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    AnyActorRef,
    TDelay
  >(SpecialTargets.Parent, event, options as any);
}

type Target<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> =
  | string
  | ActorRef<any, any>
  | ((
      args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>
    ) => string | ActorRef<any, any>);

/**
 * Forwards (sends) an event to a specified service.
 *
 * @param target The target service to forward the event to.
 * @param options Options to pass into the send action creator.
 */
export function forwardTo<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TDelay extends string
>(
  target: Target<TContext, TExpressionEvent, TExpressionAction>,
  options?: SendToActionOptions<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TDelay
  >
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
  return sendTo<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    AnyActorRef,
    TDelay
  >(target, ({ event }: any) => event, options) as {
    (args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>): void;
  };
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
  TExpressionAction extends ParameterizedObject | undefined,
  TErrorData = any
>(
  errorData:
    | TErrorData
    | ((args: UnifiedArg<TContext, TExpressionEvent>) => TErrorData),
  options?: SendToActionParams<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    EventObject,
    string
  >
) {
  return sendParent<TContext, TExpressionEvent, TExpressionAction, EventObject>(
    (arg) => {
      return {
        type: XSTATE_ERROR,
        data:
          typeof errorData === 'function' ? (errorData as any)(arg) : errorData
      };
    },
    options
  );
}
