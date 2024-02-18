import isDevelopment from '#is-development';
import {
  ActionArgs,
  AnyActorScope,
  AnyActor,
  AnyMachineSnapshot,
  DelayExpr,
  EventObject,
  MachineContext,
  NoInfer,
  RaiseActionOptions,
  SendExpr,
  ParameterizedObject,
  AnyEventObject
} from '../types.ts';

function resolveEmit(
  _: AnyActorScope,
  snapshot: AnyMachineSnapshot,
  args: ActionArgs<any, any, any>,
  actionParams: ParameterizedObject['params'] | undefined,
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
  { internalQueue }: { internalQueue: AnyEventObject[] }
) {
  const delaysMap = snapshot.machine.implementations.delays;

  if (typeof eventOrExpr === 'string') {
    throw new Error(
      `Only event objects may be used with emit; use emit({ type: "${eventOrExpr}" }) instead`
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
  if (typeof resolvedDelay !== 'number') {
    internalQueue.push(resolvedEvent);
  }
  return [snapshot, { event: resolvedEvent, id, delay: resolvedDelay }];
}

function executeEmit(
  actorScope: AnyActorScope,
  params: {
    event: EventObject;
    id: string | undefined;
    delay: number | undefined;
  }
) {
  const { event, delay, id } = params;
  // if (typeof delay === 'number') {
  actorScope.defer(() => {
    actorScope.emit(event);
  });
  return;
  // }
}

export interface RaiseAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TDelay extends string
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: TParams): void;
  _out_TEvent?: TEvent;
  _out_TDelay?: TDelay;
}

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */
export function emit<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent,
  TParams extends ParameterizedObject['params'] | undefined =
    | ParameterizedObject['params']
    | undefined,
  TDelay extends string = string
>(
  eventOrExpr:
    | AnyEventObject
    | SendExpr<TContext, TExpressionEvent, TParams, AnyEventObject, TEvent>,
  options?: RaiseActionOptions<
    TContext,
    TExpressionEvent,
    TParams,
    NoInfer<TEvent>,
    NoInfer<TDelay>
  >
): RaiseAction<TContext, TExpressionEvent, TParams, TEvent, TDelay> {
  function emit(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  emit.type = 'xstate.emit';
  emit.event = eventOrExpr;
  emit.id = options?.id;
  emit.delay = options?.delay;

  emit.resolve = resolveEmit;
  emit.execute = executeEmit;

  return emit;
}
