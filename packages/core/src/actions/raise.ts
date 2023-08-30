import isDevelopment from '#is-development';
import { cloneState } from '../State.ts';
import {
  ActionArgs,
  AnyActorContext,
  AnyActor,
  AnyState,
  DelayExpr,
  EventObject,
  MachineContext,
  NoInfer,
  RaiseActionOptions,
  SendExpr,
  ParameterizedObject
} from '../types.ts';

function resolve(
  _: AnyActorContext,
  state: AnyState,
  args: ActionArgs<any, any, any>,
  {
    event: eventOrExpr,
    id,
    delay
  }: {
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
      `Only event objects may be used with raise; use raise({ type: "${eventOrExpr}" }) instead`
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
  return [
    typeof resolvedDelay !== 'number'
      ? cloneState(state, {
          _internalQueue: state._internalQueue.concat(resolvedEvent)
        })
      : state,
    { event: resolvedEvent, id, delay: resolvedDelay }
  ];
}

function execute(
  actorContext: AnyActorContext,
  params: {
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
}

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */

export function raise<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent,
  TExpressionAction extends ParameterizedObject | undefined =
    | ParameterizedObject
    | undefined,
  TDelay extends string = string
>(
  eventOrExpr:
    | NoInfer<TEvent>
    | SendExpr<TContext, TExpressionEvent, TExpressionAction, NoInfer<TEvent>>,
  options?: RaiseActionOptions<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TDelay
  >
) {
  function raise(_: ActionArgs<TContext, TExpressionEvent, TExpressionAction>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  raise.type = 'xstate.raise';
  raise.event = eventOrExpr;
  raise.id = options?.id;
  raise.delay = options?.delay;

  raise.resolve = resolve;
  raise.execute = execute;

  return raise as {
    (args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>): void;
    _out_TEvent?: TEvent;
  };
}
