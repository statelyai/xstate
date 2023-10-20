import { Draft, produce } from 'immer';
import {
  AssignArgs,
  EventObject,
  MachineContext,
  ParameterizedObject,
  ProvidedActor,
  assign as xstateAssign
} from 'xstate';
export { immerAssign as assign };

export type ImmerAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> = (
  args: AssignArgs<
    Draft<TContext>,
    TExpressionEvent,
    TExpressionAction,
    TEvent,
    TActor
  >
) => void;

function immerAssign<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject = EventObject,
  TExpressionAction extends ParameterizedObject | undefined =
    | ParameterizedObject
    | undefined,
  TEvent extends EventObject = EventObject,
  TActor extends ProvidedActor = ProvidedActor
>(
  recipe: ImmerAssigner<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TEvent,
    TActor
  >
) {
  return xstateAssign<
    TContext,
    TExpressionEvent,
    TExpressionAction,
    TEvent,
    TActor
  >(({ context, ...rest }) => {
    return produce(
      context,
      (draft) =>
        void recipe({
          context: draft,
          ...rest
        } as any)
    );
  });
}

export interface ImmerUpdateEvent<
  TType extends string = string,
  TInput = unknown
> {
  type: TType;
  input: TInput;
}

export function createUpdater<
  TContext extends MachineContext,
  TExpressionEvent extends ImmerUpdateEvent,
  TEvent extends EventObject,
  TActor extends ProvidedActor = ProvidedActor
>(
  type: TExpressionEvent['type'],
  recipe: ImmerAssigner<
    TContext,
    TExpressionEvent,
    ParameterizedObject | undefined,
    TEvent,
    TActor
  >
) {
  const update = (input: TExpressionEvent['input']): TExpressionEvent => {
    return {
      type,
      input
    } as TExpressionEvent;
  };

  return {
    update,
    action: immerAssign<
      TContext,
      TExpressionEvent,
      ParameterizedObject | undefined, // TODO: not sure if this is correct
      TEvent,
      TActor
    >(recipe),
    type
  };
}
