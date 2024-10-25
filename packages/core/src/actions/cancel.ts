import isDevelopment from '#is-development';
import {
  AnyActorScope,
  AnyMachineSnapshot,
  EventObject,
  MachineContext,
  ActionArgs,
  ParameterizedObject
} from '../types.ts';

type ResolvableSendId<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
> =
  | string
  | ((
      args: ActionArgs<TContext, TExpressionEvent, TEvent>,
      params: TParams
    ) => string);

function resolveCancel(
  _: AnyActorScope,
  snapshot: AnyMachineSnapshot,
  actionArgs: ActionArgs<any, any, any>,
  actionParams: ParameterizedObject['params'] | undefined,
  { sendId }: { sendId: ResolvableSendId<any, any, any, any> }
) {
  const resolvedSendId =
    typeof sendId === 'function' ? sendId(actionArgs, actionParams) : sendId;
  return [snapshot, resolvedSendId];
}

function executeCancel(actorScope: AnyActorScope, resolvedSendId: string) {
  actorScope.defer(() => {
    actorScope.system.scheduler.cancel(actorScope.self, resolvedSendId);
  });
}

export interface CancelAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: TParams): void;
}

/**
 * Cancels a delayed `sendTo(...)` action that is waiting to be executed. The
 * canceled `sendTo(...)` action will not send its event or execute, unless the
 * `delay` has already elapsed before `cancel(...)` is called.
 *
 * @example
 *
 * ```ts
 * import { createMachine, sendTo, cancel } from 'xstate';
 *
 * const machine = createMachine({
 *   // ...
 *   on: {
 *     sendEvent: {
 *       actions: sendTo(
 *         'some-actor',
 *         { type: 'someEvent' },
 *         {
 *           id: 'some-id',
 *           delay: 1000
 *         }
 *       )
 *     },
 *     cancelEvent: {
 *       actions: cancel('some-id')
 *     }
 *   }
 * });
 * ```
 *
 * @param sendId The `id` of the `sendTo(...)` action to cancel.
 */
export function cancel<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
>(
  sendId: ResolvableSendId<TContext, TExpressionEvent, TParams, TEvent>
): CancelAction<TContext, TExpressionEvent, TParams, TEvent> {
  function cancel(
    _args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    _params: TParams
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  cancel.type = 'xstate.cancel';
  cancel.sendId = sendId;

  cancel.resolve = resolveCancel;
  cancel.execute = executeCancel;

  return cancel;
}
