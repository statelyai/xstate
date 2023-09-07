import isDevelopment from '#is-development';
import {
  ActionArgs,
  AnyActorContext,
  AnyState,
  EventObject,
  LogExpr,
  MachineContext,
  ParameterizedObject
} from '../types.ts';

type ResolvableLogValue<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> = string | LogExpr<TContext, TExpressionEvent, TExpressionAction>;

function resolve(
  _: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any, any>,
  {
    value,
    label
  }: { value: ResolvableLogValue<any, any, any>; label: string | undefined }
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

export interface LogAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> {
  (_: ActionArgs<TContext, TExpressionEvent, TExpressionAction>): void;
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
  TExpressionAction extends ParameterizedObject | undefined
>(
  value: ResolvableLogValue<TContext, TExpressionEvent, TExpressionAction> = ({
    context,
    event
  }) => ({ context, event }),
  label?: string
): LogAction<TContext, TExpressionEvent, TExpressionAction> {
  function log(_: ActionArgs<TContext, TExpressionEvent, TExpressionAction>) {
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
