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
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
> = string | LogExpr<TContext, TExpressionEvent, TParams, TEvent>;

function resolveLog(
  _: AnyActorContext,
  state: AnyState,
  actionArgs: ActionArgs<any, any, any, any>,
  {
    value,
    label
  }: {
    value: ResolvableLogValue<any, any, any, any>;
    label: string | undefined;
  }
) {
  return [
    state,
    {
      value: typeof value === 'function' ? value(actionArgs) : value,
      label
    }
  ];
}

function executeLog(
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
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
> {
  (_: ActionArgs<TContext, TExpressionEvent, TParams, TEvent>): void;
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
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
>(
  value: ResolvableLogValue<TContext, TExpressionEvent, TParams, TEvent> = ({
    context,
    event
  }) => ({ context, event }),
  label?: string
): LogAction<TContext, TExpressionEvent, TParams, TEvent> {
  function log(_: ActionArgs<TContext, TExpressionEvent, TParams, TEvent>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  log.type = 'xstate.log';
  log.value = value;
  log.label = label;

  log.resolve = resolveLog;
  log.execute = executeLog;

  return log;
}
