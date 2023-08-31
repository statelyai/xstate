import { Draft, produce } from 'immer';
import {
  AssignArgs,
  EventObject,
  MachineContext,
  ParameterizedObject,
  ProvidedActor,
  assign as xstateAssign
} from 'xstate';
export { type AssignArgs };

export type ImmerAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined,
  TActor extends ProvidedActor
> = (
  args: AssignArgs<Draft<TContext>, TExpressionEvent, TExpressionAction, TActor>
) => void;

function immerAssign<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject = EventObject,
  TExpressionAction extends ParameterizedObject | undefined =
    | ParameterizedObject
    | undefined,
  TActor extends ProvidedActor = ProvidedActor
>(
  recipe: ImmerAssigner<TContext, TExpressionEvent, TExpressionAction, TActor>
) {
  return xstateAssign<TContext, TExpressionEvent, TExpressionAction, TActor>(
    ({ context, ...rest }) => {
      return produce(
        context,
        (draft) =>
          void recipe({
            context: draft,
            ...rest
          })
      );
    }
  );
}

export { immerAssign as assign };

export interface ImmerUpdateEvent<
  TType extends string = string,
  TInput = unknown
> {
  type: TType;
  input: TInput;
}

export function createUpdater<
  TContext extends MachineContext,
  TEvent extends ImmerUpdateEvent,
  TActor extends ProvidedActor = ProvidedActor
>(
  type: TEvent['type'],
  recipe: ImmerAssigner<
    TContext,
    TEvent,
    ParameterizedObject | undefined,
    TActor
  >
) {
  const update = (input: TEvent['input']): TEvent => {
    return {
      type,
      input
    } as TEvent;
  };

  return {
    update,
    action: immerAssign<
      TContext,
      TEvent,
      ParameterizedObject | undefined, // TODO: not sure if this is correct
      TActor
    >(recipe),
    type
  };
}
