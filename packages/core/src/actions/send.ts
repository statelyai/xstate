import isDevelopment from '#is-development';
import { XSTATE_ERROR } from '../constants.ts';
import { createErrorActorEvent } from '../eventUtils.ts';
import { executingCustomAction } from '../createActor.ts';
import {
  ActionArgs,
  ActionFunction,
  AnyActorRef,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  Cast,
  DelayExpr,
  DoNotInfer,
  EventFrom,
  EventObject,
  ExecutableActionObject,
  InferEvent,
  MachineContext,
  ParameterizedObject,
  SendExpr,
  SendToActionOptions,
  BuiltinActionResolution,
  SpecialTargets,
  UnifiedArg
} from '../types.ts';

function resolveSendTo(
  actorScope: AnyActorScope,
  snapshot: AnyMachineSnapshot,
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
): BuiltinActionResolution {
  const delaysMap = snapshot.machine.implementations.delays;

  if (typeof eventOrExpr === 'string') {
    throw new Error(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (resolvedTarget === SpecialTargets.Parent) {
      targetActorRef = actorScope.self._parent;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    else if (resolvedTarget === SpecialTargets.Internal) {
      targetActorRef = actorScope.self;
    } else if (resolvedTarget.startsWith('#_')) {
      // SCXML compatibility: https://www.w3.org/TR/scxml/#SCXMLEventProcessor
      // #_invokeid. If the target is the special term '#_invokeid', where invokeid is the invokeid of an SCXML session that the sending session has created by <invoke>, the Processor must add the event to the external queue of that session.
      targetActorRef = snapshot.children[resolvedTarget.slice(2)];
    } else {
      targetActorRef = extra.deferredActorIds?.includes(resolvedTarget)
        ? resolvedTarget
        : snapshot.children[resolvedTarget];
    }
    if (!targetActorRef) {
      throw new Error(
        `Unable to send event to actor '${resolvedTarget}' from machine '${snapshot.machine.id}'.`
      );
    }
  } else {
    targetActorRef = resolvedTarget || actorScope.self;
  }

  return [
    snapshot,
    {
      to: targetActorRef,
      targetId: typeof resolvedTarget === 'string' ? resolvedTarget : undefined,
      event: resolvedEvent,
      id,
      delay: resolvedDelay
    },
    undefined
  ];
}

function retryResolveSendTo(
  _: AnyActorScope,
  snapshot: AnyMachineSnapshot,
  params: {
    to: AnyActorRef;
    event: EventObject;
    id: string | undefined;
    delay: number | undefined;
  }
) {
  if (typeof params.to === 'string') {
    params.to = snapshot.children[params.to];
  }
}

function executeSendTo(
  actorScope: AnyActorScope,
  params: {
    to: AnyActorRef;
    event: EventObject;
    id: string | undefined;
    delay: number | undefined;
  }
) {
  // this forms an outgoing events queue
  // thanks to that the recipient actors are able to read the *updated* snapshot value of the sender
  actorScope.defer(() => {
    const { to, event, delay, id } = params;
    if (typeof delay === 'number') {
      actorScope.system.scheduler.schedule(
        actorScope.self,
        to,
        event,
        delay,
        id
      );
      return;
    }
    actorScope.system._relay(
      actorScope.self,
      // at this point, in a deferred task, it should already be mutated by retryResolveSendTo
      // if it initially started as a string
      to,
      event.type === XSTATE_ERROR
        ? createErrorActorEvent(actorScope.self.id, (event as any).data)
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
 * @param event The event to send, or an expression that evaluates to the event
 *   to send
 * @param options Send action options
 *
 *   - `id` - The unique send event identifier (used with `cancel()`).
 *   - `delay` - The number of milliseconds to delay the sending of the event.
 */
export function sendTo<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TTargetActor extends AnyActorRef,
  TEvent extends EventObject,
  TDelay extends string = never,
  TUsedDelay extends TDelay = never
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
    DoNotInfer<TEvent>,
    TUsedDelay
  >
): ActionFunction<
  TContext,
  TExpressionEvent,
  TEvent,
  TParams,
  never,
  never,
  never,
  TDelay,
  never
> {
  if (isDevelopment && executingCustomAction) {
    console.warn(
      'Custom actions should not call `sendTo()` directly, as it is not imperative. See https://stately.ai/docs/actions#built-in-actions for more details.'
    );
  }

  function sendTo(
    _args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    _params: TParams
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

export interface ExecutableSendToAction extends ExecutableActionObject {
  type: 'xstate.sendTo';
  params: {
    event: EventObject;
    id: string | undefined;
    delay: number | undefined;
    to: AnyActorRef;
  };
}
