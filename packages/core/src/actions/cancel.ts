import {
  AnyActorContext,
  AnyInterpreter,
  AnyState,
  EventObject,
  MachineContext,
  UnifiedArg
} from '../types.ts';
import { BuiltinAction } from './_shared.ts';

type ResolvableSendId<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> = string | ((args: UnifiedArg<TContext, TExpressionEvent>) => string);

class CancelResolver<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends BuiltinAction<TContext, TExpressionEvent, TEvent> {
  static sendId: ResolvableSendId<any, any>;
  static resolve(
    _: AnyActorContext,
    state: AnyState,
    args: UnifiedArg<any, any>
  ) {
    const { sendId } = this;
    const resolvedSendId = typeof sendId === 'function' ? sendId(args) : sendId;
    return [state, resolvedSendId];
  }
  static execute(actorContext: AnyActorContext, resolvedSendId: string) {
    (actorContext.self as AnyInterpreter).cancel(resolvedSendId);
  }
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
  return class Cancel extends CancelResolver<
    TContext,
    TExpressionEvent,
    TEvent
  > {
    static sendId = sendId;
  };
}
