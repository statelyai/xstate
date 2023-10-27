import isDevelopment from '#is-development';
import { createErrorActorEvent } from '../eventUtils.ts';
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

function resolveSendTo(
  actorContext: AnyActorContext,
  state: AnyState,
  args: ActionArgs<any, any, any>,
  actionParams: ParameterizedObject['params'] | undefined,
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
          args: UnifiedArg<MachineContext, EventObject, EventObject>,
          params: ParameterizedObject['params'] | undefined
        ) => AnyActorRef | string);
    event:
      | EventObject
      | SendExpr<
          MachineContext,
          EventObject,
          ParameterizedObject['params'] | undefined,
          EventObject,
          EventObject
        >;
    id: string | undefined;
    delay:
      | string
      | number
      | DelayExpr<
          MachineContext,
          EventObject,
          ParameterizedObject['params'] | undefined,
          EventObject
        >
      | undefined;
  },
  extra: { deferredActorIds: string[] | undefined }
) {
  const delaysMap = state.machine.implementations.delays;

  if (typeof eventOrExpr === 'string') {
    throw new Error(
      `Only event objects may be used with sendTo; use sendTo({ type: "${eventOrExpr}" }) instead`
    );
  }
  const resolvedEvent =
    typeof eventOrExpr === 'function'
      ? eventOrExpr(args, actionParams)
      : eventOrExpr;

  let resolvedDelay: number | undefined;
  if (typeof delay === 'string') {
    const configDelay = delaysMap && delaysMap[delay];
    resolvedDelay =
      typeof configDelay === 'function'
        ? configDelay(args, actionParams)
        : configDelay;
  } else {
    resolvedDelay =
      typeof delay === 'function' ? delay(args, actionParams) : delay;
  }

  const resolvedTarget = typeof to === 'function' ? to(args, actionParams) : to;
  let targetActorRef: AnyActorRef | string | undefined;

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
      targetActorRef = extra.deferredActorIds?.includes(resolvedTarget)
        ? resolvedTarget
        : state.children[resolvedTarget];
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

function retryResolveSendTo(
  _: AnyActorContext,
  state: AnyState,
  params: {
    to: AnyActorRef;
    event: EventObject;
    id: string | undefined;
    delay: number | undefined;
  }
) {
  if (typeof params.to === 'string') {
    params.to = state.children[params.to];
  }
}

function executeSendTo(
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

  // this forms an outgoing events queue
  // thanks to that the recipient actors are able to read the *updated* snapshot value of the sender
  actorContext.defer(() => {
    const { to, event } = params;
    actorContext?.system._relay(
      actorContext.self,
      to,
      event.type === XSTATE_ERROR
        ? createErrorActorEvent(actorContext.self.id, (event as any).data)
        : event
    );
  });
}

export interface SendToAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TDelay extends string
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: TParams): void;
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
  TParams extends ParameterizedObject['params'] | undefined,
  TTargetActor extends AnyActorRef,
  TEvent extends EventObject,
  TDelay extends string
>(
  to:
    | TTargetActor
    | string
    | ((
        args: ActionArgs<TContext, TExpressionEvent, TEvent>,
        params: TParams
      ) => TTargetActor | string),
  eventOrExpr:
    | EventFrom<TTargetActor>
    | SendExpr<
        TContext,
        TExpressionEvent,
        TParams,
        InferEvent<Cast<EventFrom<TTargetActor>, EventObject>>,
        TEvent
      >,
  options?: SendToActionOptions<
    TContext,
    TExpressionEvent,
    TParams,
    NoInfer<TEvent>,
    NoInfer<TDelay>
  >
): SendToAction<TContext, TExpressionEvent, TParams, TEvent, TDelay> {
  function sendTo(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
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

  sendTo.resolve = resolveSendTo;
  sendTo.retryResolve = retryResolveSendTo;
  sendTo.execute = executeSendTo;

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
  TParams extends ParameterizedObject['params'] | undefined,
  TSentEvent extends EventObject = AnyEventObject,
  TEvent extends EventObject = AnyEventObject,
  TDelay extends string = string
>(
  event:
    | TSentEvent
    | SendExpr<TContext, TExpressionEvent, TParams, TSentEvent, TEvent>,
  options?: SendToActionOptions<
    TContext,
    TExpressionEvent,
    TParams,
    TEvent,
    TDelay
  >
) {
  return sendTo<
    TContext,
    TExpressionEvent,
    TParams,
    AnyActorRef,
    TEvent,
    TDelay
  >(SpecialTargets.Parent, event, options as any);
}

type Target<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
> =
  | string
  | ActorRef<any, any>
  | ((
      args: ActionArgs<TContext, TExpressionEvent, TEvent>,
      params: TParams
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
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TDelay extends string
>(
  target: Target<TContext, TExpressionEvent, TParams, TEvent>,
  options?: SendToActionOptions<
    TContext,
    TExpressionEvent,
    TParams,
    TEvent,
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
    TParams,
    AnyActorRef,
    TEvent,
    TDelay
  >(target, ({ event }: any) => event, options);
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
  TParams extends ParameterizedObject['params'] | undefined,
  TErrorData = any,
  TEvent extends EventObject = AnyEventObject
>(
  errorData:
    | TErrorData
    | ((args: UnifiedArg<TContext, TExpressionEvent, TEvent>) => TErrorData),
  options?: SendToActionParams<
    TContext,
    TExpressionEvent,
    TParams,
    EventObject,
    TEvent,
    string
  >
) {
  return sendParent<TContext, TExpressionEvent, TParams, EventObject, TEvent>(
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
