import isDevelopment from '#is-development';
import {
  AnyActorScope,
  AnyActor,
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
  (actorScope.self as AnyActor).cancel(resolvedSendId);
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
 * Cancels an in-flight `send(...)` action. A canceled sent action will not
 * be executed, nor will its event be sent, unless it has already been sent
 * (e.g., if `cancel(...)` is called after the `send(...)` action's `delay`).
 *
 * @param sendId The `id` of the `send(...)` action to cancel.
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
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: TParams
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
