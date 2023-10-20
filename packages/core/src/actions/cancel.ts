import isDevelopment from '#is-development';
import {
  AnyActorContext,
  AnyActor,
  AnyState,
  EventObject,
  MachineContext,
  ActionArgs,
  ParameterizedObject
} from '../types.ts';

type ResolvableSendId<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> =
  | string
  | ((
      args: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
    ) => string);

function resolveCancel(
  _: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any, any, any>,
  { sendId }: { sendId: ResolvableSendId<any, any, any, any> }
) {
  const resolvedSendId =
    typeof sendId === 'function' ? sendId(actionArgs) : sendId;
  return [state, resolvedSendId];
}

function executeCancel(actorContext: AnyActorContext, resolvedSendId: string) {
  (actorContext.self as AnyActor).cancel(resolvedSendId);
}

export interface CancelAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
> {
  (_: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>): void;
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
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject
>(
  sendId: ResolvableSendId<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TEvent
  >
): CancelAction<TContext, TExpressionEvent, TExpressionAction, TEvent> {
  function cancel(
    _: ActionArgs<TContext, TExpressionEvent, TExpressionAction, TEvent>
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
