import isDevelopment from '#is-development';
import {
  ActionArgs,
  AnyActorScope,
  AnyMachineSnapshot,
  EventObject,
  MachineContext,
  SendExpr,
  ParameterizedObject,
  ActionFunction
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
  if (isDevelopment && typeof eventOrExpr === 'string') {
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
  {
    event
  }: {
    event: EventObject;
  }
) {
  actorScope.defer(() => {
    actorScope.emit(event);
  });
}

export interface EmitAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TEmitted extends EventObject
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: TParams): void;
  _out_TEvent?: TEvent;
  _out_TEmitted?: TEmitted;
}

/**
 * Emits an event.
 *
 * @param eventType The event to emit.
 */
export function emit<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  eventOrExpr:
    | TEmitted
    | SendExpr<TContext, TExpressionEvent, TParams, TEmitted, TEvent>
): ActionFunction<
  TContext,
  TExpressionEvent,
  TEvent,
  TParams,
  never,
  never,
  never,
  never,
  TEmitted
> {
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
