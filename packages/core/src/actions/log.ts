import isDevelopment from '#is-development';
import {
  ActionArgs,
  AnyActorScope,
  AnyMachineSnapshot,
  EventObject,
  LogExpr,
  MachineContext,
  ParameterizedObject,
  SpecialActionResolution
} from '../types.ts';

type ResolvableLogValue<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject
> = string | LogExpr<TContext, TExpressionEvent, TParams, TEvent>;

function resolveLog(
  _: AnyActorScope,
  snapshot: AnyMachineSnapshot,
  actionArgs: ActionArgs<any, any, any>,
  actionParams: ParameterizedObject['params'] | undefined,
  {
    value,
    label
  }: {
    value: ResolvableLogValue<any, any, any, any>;
    label: string | undefined;
  }
): SpecialActionResolution {
  return [
    snapshot,
    {
      value:
        typeof value === 'function' ? value(actionArgs, actionParams) : value,
      label
    },
    undefined
  ];
}

function executeLog(
  { logger }: AnyActorScope,
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
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: TParams): void;
}

/**
 * @param expr The expression function to evaluate which will be logged. Takes
 *   in 2 arguments:
 *
 *   - `ctx` - the current state context
 *   - `event` - the event that caused this action to be executed.
 *
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
  function log(
    _args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    _params: TParams
  ) {
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
