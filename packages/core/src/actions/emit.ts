import isDevelopment from '#is-development';
import {
  ActionArgs,
  AnyActorScope,
  AnyMachineSnapshot,
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
    event: eventOrExpr
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
  }
) {
  if (typeof eventOrExpr === 'string') {
    throw new Error(
      `Only event objects may be used with emit; use emit({ type: "${eventOrExpr}" }) instead`
    );
  }
  const resolvedEvent =
    typeof eventOrExpr === 'function'
      ? eventOrExpr(args, actionParams)
      : eventOrExpr;
  return [snapshot, { event: resolvedEvent }];
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

export interface EmitAction<
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
 * Emits an event.
 *
 * @param eventType The event to emit.
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
    | SendExpr<TContext, TExpressionEvent, TParams, AnyEventObject, TEvent>
): EmitAction<TContext, TExpressionEvent, TParams, TEvent, TDelay> {
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

  emit.resolve = resolveEmit;
  emit.execute = executeEmit;

  return emit;
}
