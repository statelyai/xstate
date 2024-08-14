import isDevelopment from '#is-development';
import { executingCustomAction } from '../stateUtils.ts';
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
  args: ActionArgs<any, any, any, any>,
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
  actorScope.defer(() => actorScope.emit(event));
}

export interface EmitAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TEmitted extends EventObject
> {
  (
    args: ActionArgs<TContext, TExpressionEvent, TEvent, TEmitted>,
    params: TParams
  ): void;
  _out_TEmitted?: TEmitted;
}

/**
 * Emits an event to event handlers registered on the actor via `actor.on(event,
 * handler)`.
 *
 * @example
 *
 * ```ts
 * import { emit } from 'xstate';
 *
 * const machine = createMachine({
 *   // ...
 *   on: {
 *     something: {
 *       actions: emit({
 *         type: 'emitted',
 *         some: 'data'
 *       })
 *     }
 *   }
 *   // ...
 * });
 *
 * const actor = createActor(machine).start();
 *
 * actor.on('emitted', (event) => {
 *   console.log(event);
 * });
 *
 * actor.send({ type: 'something' });
 * // logs:
 * // {
 * //   type: 'emitted',
 * //   some: 'data'
 * // }
 * ```
 */
export function emit<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  /** The event to emit, or an expression that returns an event to emit. */
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
  if (isDevelopment && executingCustomAction) {
    console.warn(
      'Custom actions should not call `emit()` directly, as it is not imperative. See https://stately.ai/docs/actions#built-in-actions for more details.'
    );
  }

  function emit(
    args: ActionArgs<TContext, TExpressionEvent, TEvent, TEmitted>,
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
