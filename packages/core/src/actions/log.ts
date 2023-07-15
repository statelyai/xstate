import isDevelopment from '#is-development';
import {
  ActionArgs,
  AnyActorContext,
  AnyState,
  EventObject,
  LogExpr,
  MachineContext
} from '../types.ts';

type ResolvableLogValue<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> = string | LogExpr<TContext, TExpressionEvent>;

function resolve(
  _: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any>,
  {
    value,
    label
  }: { value: ResolvableLogValue<any, any>; label: string | undefined }
) {
  return [
    state,
    {
      value: typeof value === 'function' ? value(actionArgs) : value,
      label
    }
  ];
}

function execute(
  { logger }: AnyActorContext,
  { value, label }: { value: unknown; label: string | undefined }
) {
  if (label) {
    logger(label, value);
  } else {
    logger(value);
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
  function log(_: ActionArgs<TContext, TExpressionEvent>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  log.type = 'xstate.log';
  log.value = value;
  log.label = label;

  log.resolve = resolve;
  log.execute = execute;

  return log;
}
