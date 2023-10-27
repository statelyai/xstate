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
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> = (
  args: AssignArgs<Draft<TContext>, TExpressionEvent, TEvent, TActor>,
  params: TParams
) => void;

function immerAssign<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject = EventObject,
  TParams extends ParameterizedObject['params'] | undefined =
    | ParameterizedObject['params']
    | undefined,
  TEvent extends EventObject = EventObject,
  TActor extends ProvidedActor = ProvidedActor
>(recipe: ImmerAssigner<TContext, TExpressionEvent, TParams, TEvent, TActor>) {
  return xstateAssign<TContext, TExpressionEvent, TParams, TEvent, TActor>(
    ({ context, ...rest }, params) => {
      return produce(
        context,
        (draft) =>
          void recipe(
            {
              context: draft,
              ...rest
            } as any,
            params
          )
      );
    }
  );
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
    ParameterizedObject['params'] | undefined,
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
      ParameterizedObject['params'] | undefined, // TODO: not sure if this is correct
      TEvent,
      TActor
    >(recipe),
    type
  };
}
