import isDevelopment from '#is-development';
import {
  ActionArgs,
  ActionFunction,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  DelayExpr,
  DoNotInfer,
  EventObject,
  MachineContext,
  ParameterizedObject,
  RaiseActionOptions,
  SendExpr
} from '../types.ts';

function resolveRaise(
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
      `Only event objects may be used with raise; use raise({ type: "${eventOrExpr}" }) instead`
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

function executeRaise(
  actorScope: AnyActorScope,
  params: {
    event: EventObject;
    id: string | undefined;
    delay: number | undefined;
  }
) {
  const { event, delay, id } = params;
  if (typeof delay === 'number') {
    actorScope.defer(() => {
      const self = actorScope.self;
      actorScope.system.scheduler.schedule(self, self, event, delay, id);
    });
    return;
  }
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
export function raise<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TDelay extends string = never,
  TUsedDelay extends TDelay = never
>(
  eventOrExpr:
    | DoNotInfer<TEvent>
    | SendExpr<TContext, TExpressionEvent, TParams, DoNotInfer<TEvent>, TEvent>,
  options?: RaiseActionOptions<
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
  function raise(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  raise.type = 'xstate.raise';
  raise.event = eventOrExpr;
  raise.id = options?.id;
  raise.delay = options?.delay;

  raise.resolve = resolveRaise;
  raise.execute = executeRaise;

  return raise;
}
