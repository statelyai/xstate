import isDevelopment from '#is-development';
import {
  AnyActorContext,
  AnyActor,
  AnyState,
  EventObject,
  MachineContext,
  ActionArgs
} from '../types.ts';

type ResolvableSendId<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> = string | ((args: ActionArgs<TContext, TExpressionEvent>) => string);

function resolve(
  _: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any>,
  { sendId }: { sendId: ResolvableSendId<any, any> }
) {
  const resolvedSendId =
    typeof sendId === 'function' ? sendId(actionArgs) : sendId;
  return [state, resolvedSendId];
}

function execute(actorContext: AnyActorContext, resolvedSendId: string) {
  (actorContext.self as AnyActor).cancel(resolvedSendId);
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
  TEvent extends EventObject
>(sendId: ResolvableSendId<TContext, TExpressionEvent>) {
  function cancel(_: ActionArgs<TContext, TExpressionEvent>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  cancel.type = 'xstate.cancel';
  cancel.sendId = sendId;

  cancel.resolve = resolve;
  cancel.execute = execute;

  return cancel;
}
