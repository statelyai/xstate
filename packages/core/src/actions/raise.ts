import { createDynamicAction } from '../../actions/dynamicAction.ts';
import * as actionTypes from '../actionTypes.ts';
import {
  EventObject,
  MachineContext,
  RaiseActionObject,
  BaseDynamicActionObject,
  RaiseActionOptions,
  SendExpr,
  AnyInterpreter,
  RaiseActionParams,
  NoInfer,
  UnifiedArg,
  StateMeta
} from '../types.ts';

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
): BaseDynamicActionObject<
  TContext,
  TExpressionEvent,
  TEvent,
  RaiseActionObject<TContext, TExpressionEvent, TEvent>,
  RaiseActionParams<TContext, TExpressionEvent, TEvent>
> {
  return createDynamicAction(
    {
      type: actionTypes.raise,
      params: {
        delay: options ? options.delay : undefined,
        event: eventOrExpr,
        id:
          options && options.id !== undefined
            ? options.id
            : typeof eventOrExpr === 'function'
            ? eventOrExpr.name
            : eventOrExpr.type
      }
    },
    (event, { state, actorContext }) => {
      const params = {
        delay: options ? options.delay : undefined,
        event: eventOrExpr,
        id:
          options && options.id !== undefined
            ? options.id
            : typeof eventOrExpr === 'function'
            ? eventOrExpr.name
            : eventOrExpr.type
      };
      const args: UnifiedArg<TContext, TExpressionEvent> &
        StateMeta<TExpressionEvent> = {
        context: state.context,
        event,
        self: actorContext?.self ?? ({} as any),
        system: actorContext?.system
      };
      const delaysMap = state.machine.implementations.delays;

      // TODO: helper function for resolving Expr
      if (typeof eventOrExpr === 'string') {
        throw new Error(
          `Only event objects may be used with raise; use raise({ type: "${eventOrExpr}" }) instead`
        );
      }
      const resolvedEvent =
        typeof eventOrExpr === 'function' ? eventOrExpr(args) : eventOrExpr;

      let resolvedDelay: number | undefined;
      if (typeof params.delay === 'string') {
        const configDelay = delaysMap && delaysMap[params.delay];
        resolvedDelay =
          typeof configDelay === 'function' ? configDelay(args) : configDelay;
      } else {
        resolvedDelay =
          typeof params.delay === 'function'
            ? params.delay(args)
            : params.delay;
      }

      const resolvedAction: RaiseActionObject<
        TContext,
        TExpressionEvent,
        TEvent
      > = {
        type: actionTypes.raise,
        params: {
          ...params,
          event: resolvedEvent,
          delay: resolvedDelay
        },
        execute: (actorCtx) => {
          if (typeof resolvedAction.params.delay === 'number') {
            (actorCtx.self as AnyInterpreter).delaySend(resolvedAction);
            return;
          }
        }
      };

      return [state, resolvedAction];
    }
  );
}
