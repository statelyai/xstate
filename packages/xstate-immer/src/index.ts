import { Draft, produce } from 'immer';
import {
  AssignArgs,
  EventObject,
  MachineContext,
  ParameterizedObject,
  assign as xstateAssign
} from 'xstate';

export type ImmerAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> = (
  args: AssignArgs<Draft<TContext>, TExpressionEvent, TExpressionAction>
) => void;

function immerAssign<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject = EventObject,
  TExpressionAction extends ParameterizedObject | undefined =
    | ParameterizedObject
    | undefined
>(recipe: ImmerAssigner<TContext, TExpressionEvent, TExpressionAction>) {
  return xstateAssign<TContext, TExpressionEvent, TExpressionAction>(
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
  TEvent extends ImmerUpdateEvent
>(
  type: TEvent['type'],
  recipe: ImmerAssigner<TContext, TEvent, ParameterizedObject | undefined>
) {
  const update = (input: TEvent['input']): TEvent => {
    return {
      type,
      input
    } as TEvent;
  };

  return {
    update,
    action: immerAssign<TContext, TEvent>(recipe),
    type
  };
}
