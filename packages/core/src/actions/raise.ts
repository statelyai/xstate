import { cloneState } from '../State.ts';
import {
  AnyActorContext,
  AnyInterpreter,
  AnyState,
  DelayExpr,
  EventObject,
  MachineContext,
  NoInfer,
  RaiseActionOptions,
  SendExpr,
  UnifiedArg
} from '../types.ts';
import { BuiltinAction } from './_shared.ts';

class RaiseResolver<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends BuiltinAction<TContext, TExpressionEvent, TEvent> {
  static event:
    | EventObject
    | SendExpr<MachineContext, EventObject, EventObject>;
  static id: string | undefined;
  static delay:
    | string
    | number
    | DelayExpr<MachineContext, EventObject>
    | undefined;
  static resolve(
    _: AnyActorContext,
    state: AnyState,
    args: UnifiedArg<any, any>
  ) {
    const { event: eventOrExpr, id, delay } = this;

    const delaysMap = state.machine.implementations.delays;

    if (typeof eventOrExpr === 'string') {
      throw new Error(
        `Only event objects may be used with raise; use raise({ type: "${eventOrExpr}" }) instead`
      );
    }
    const resolvedEvent =
      typeof eventOrExpr === 'function' ? eventOrExpr(args) : eventOrExpr;

    let resolvedDelay: number | undefined;
    if (typeof delay === 'string') {
      const configDelay = delaysMap && delaysMap[delay];
      resolvedDelay =
        typeof configDelay === 'function' ? configDelay(args) : configDelay;
    } else {
      resolvedDelay = typeof delay === 'function' ? delay(args) : delay;
    }
    return [
      typeof resolvedDelay !== 'number'
        ? cloneState(state, {
            _internalQueue: state._internalQueue.concat(resolvedEvent)
          })
        : state,
      { event: resolvedEvent, id, delay: resolvedDelay }
    ];
  }
  static execute(
    actorContext: AnyActorContext,
    params: {
      event: EventObject;
      id: string | undefined;
      delay: number | undefined;
    }
  ) {
    if (typeof params.delay === 'number') {
      (actorContext.self as AnyInterpreter).delaySend(
        params as typeof params & { delay: number }
      );
      return;
    }
  }
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
  TEvent extends EventObject = TExpressionEvent
>(
  eventOrExpr:
    | NoInfer<TEvent>
    | SendExpr<TContext, TExpressionEvent, NoInfer<TEvent>>,
  options?: RaiseActionOptions<TContext, TExpressionEvent>
) {
  return class Raise extends RaiseResolver<TContext, TExpressionEvent, TEvent> {
    static event = eventOrExpr as any;
    static id = options?.id;
    static delay = options?.delay as any;
  };
}
