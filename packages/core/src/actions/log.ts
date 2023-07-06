import {
  AnyActorContext,
  EventObject,
  LogExpr,
  MachineContext
} from '../types.ts';
import { AnyState, UnifiedArg } from '../index.ts';
import { BuiltinAction } from './_shared.ts';

type ResolvableLogValue<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> = string | LogExpr<TContext, TExpressionEvent>;

class LogResolver<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> extends BuiltinAction<TContext, TExpressionEvent, TEvent> {
  static value: ResolvableLogValue<any, any>;
  static label: string | undefined;
  static resolve(
    _: AnyActorContext,
    state: AnyState,
    args: UnifiedArg<any, any>
  ) {
    const { value, label } = this;

    return [
      state,
      {
        value: typeof value === 'function' ? value(args) : value,
        label
      }
    ];
  }
  static execute(
    { logger }: AnyActorContext,
    { value, label }: { value: unknown; label: string | undefined }
  ) {
    if (label) {
      logger(label, value);
    } else {
      logger(value);
    }
  }
}

/**
 *
 * @param expr The expression function to evaluate which will be logged.
 *  Takes in 2 arguments:
 *  - `ctx` - the current state context
 *  - `event` - the event that caused this action to be executed.
 * @param label The label to give to the logged expression.
 */
export function log<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent
>(
  value: ResolvableLogValue<TContext, TExpressionEvent> = ({
    context,
    event
  }) => ({ context, event }),
  label?: string
) {
  return class Log extends LogResolver<TContext, TExpressionEvent, TEvent> {
    static value = value;
    static label = label;
  };
}
