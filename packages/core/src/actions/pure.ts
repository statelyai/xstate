import {
  Actions,
  EventObject,
  MachineContext,
  NoInfer,
  ParameterizedObject,
  ProvidedActor
} from '../types.ts';
import { toArray } from '../utils.ts';
import { EnqueueActionsAction, enqueueActions } from './enqueueActions.ts';

/**
 *
 * @deprecated Use `enqueueActions(...)` instead
 */
export function pure<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = string
>(
  getActions: ({
    context,
    event
  }: {
    context: TContext;
    event: TExpressionEvent;
  }) =>
    | Actions<
        TContext,
        TExpressionEvent,
        NoInfer<TEvent>,
        undefined,
        TActor,
        NoInfer<TAction>,
        NoInfer<TGuard>,
        TDelay
      >
    | undefined
): EnqueueActionsAction<
  TContext,
  TExpressionEvent,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TDelay
> {
  return enqueueActions(({ context, event, enqueue }) => {
    toArray(getActions({ context, event })).forEach(enqueue);
  });
}
