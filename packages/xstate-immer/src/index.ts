import { Draft, produce } from 'immer';
import {
  AssignArgs,
  EventObject,
  MachineContext,
  assign as xstateAssign
} from 'xstate';

export type ImmerAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject
> = (args: AssignArgs<Draft<TContext>, TExpressionEvent>) => void;

function immerAssign<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject = EventObject,
  TEvent extends EventObject = TExpressionEvent
>(recipe: ImmerAssigner<TContext, TExpressionEvent>) {
  return xstateAssign<TContext, TExpressionEvent, TEvent>(
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
>(type: TEvent['type'], recipe: ImmerAssigner<TContext, TEvent>) {
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
