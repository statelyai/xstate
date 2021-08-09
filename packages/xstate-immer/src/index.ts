import {
  EventObject,
  BaseActionObject,
  assign as xstateAssign,
  AssignMeta,
  MachineContext,
  DynamicAssignAction
} from 'xstate';
import { produce, Draft } from 'immer';

export type ImmerAssigner<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (
  context: Draft<TContext>,
  event: TEvent,
  meta: AssignMeta<TContext, TEvent>
) => void;

export interface ImmerAssignAction<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends BaseActionObject {
  assignment: ImmerAssigner<TContext, TEvent>;
}

function immerAssign<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject
>(recipe: ImmerAssigner<TContext, TEvent>) {
  return xstateAssign<TContext, TEvent>((context, event, meta) => {
    return produce(context, (draft) => void recipe(draft, event, meta));
  });
}

export { immerAssign as assign };

export interface ImmerUpdateEvent<
  TType extends string = string,
  TInput = unknown
> {
  type: TType;
  input: TInput;
}

export interface ImmerUpdater<
  TContext extends MachineContext,
  TEvent extends ImmerUpdateEvent
> {
  update: (input: TEvent['input']) => TEvent;
  action: DynamicAssignAction<TContext, TEvent>;
  type: TEvent['type'];
}

export function createUpdater<
  TContext extends MachineContext,
  TEvent extends ImmerUpdateEvent
>(
  type: TEvent['type'],
  recipe: ImmerAssigner<TContext, TEvent>
): ImmerUpdater<TContext, TEvent> {
  const update = (input: TEvent['input']): TEvent => {
    return {
      type,
      input
    } as TEvent;
  };

  return {
    update,
    action: immerAssign<TContext, TEvent>((ctx, event, meta) => {
      recipe(ctx, event, meta);
    }),
    type
  };
}
