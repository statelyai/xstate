import { createDynamicAction } from '../../actions/dynamicAction.js';
import * as actionTypes from '../actionTypes.js';
import {
  EventObject,
  MachineContext,
  RaiseActionObject,
  BaseDynamicActionObject,
  RaiseActionOptions,
  SendExpr,
  AnyInterpreter,
  RaiseActionParams,
  NoInfer
} from '../types.js';
import { toSCXMLEvent } from '../utils.js';

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
    (_event, { state }) => {
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
      const meta = {
        _event
      };
      const delaysMap = state.machine.options.delays;

      // TODO: helper function for resolving Expr
      const resolvedEvent = toSCXMLEvent(
        typeof eventOrExpr === 'function'
          ? eventOrExpr(state.context, _event.data, meta)
          : eventOrExpr
      );

      let resolvedDelay: number | undefined;
      if (typeof params.delay === 'string') {
        const configDelay = delaysMap && delaysMap[params.delay];
        resolvedDelay =
          typeof configDelay === 'function'
            ? configDelay(state.context, _event.data, meta)
            : configDelay;
      } else {
        resolvedDelay =
          typeof params.delay === 'function'
            ? params.delay(state.context, _event.data, meta)
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
          _event: resolvedEvent,
          event: resolvedEvent.data,
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
