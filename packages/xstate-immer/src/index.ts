import {
  EventObject,
  ActionObject,
  AssignAction,
  assign as xstateAssign
} from 'xstate';
import { produce, Draft } from 'immer';

export type ImmerAssigner<TContext, TEvent extends EventObject> = (
  context: Draft<TContext>,
  event: TEvent
) => void;

export interface ImmerAssignAction<TContext, TEvent extends EventObject>
  extends ActionObject<TContext, TEvent> {
  assignment: ImmerAssigner<TContext, TEvent>;
}

function immerAssign<TContext, TEvent extends EventObject = EventObject>(
  assignment: ImmerAssigner<TContext, TEvent>
): AssignAction<TContext, TEvent> {
  return xstateAssign((context, event) => {
    return produce(context, (draft) => void assignment(draft, event));
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

export interface ImmerUpdater<TContext, TEvent extends ImmerUpdateEvent> {
  update: (input: TEvent['input']) => TEvent;
  assign: AssignAction<TContext, TEvent>;
  type: TEvent['type'];
  validate?: (context: TContext, input: TEvent['input']) => boolean;
}

export function createUpdater<TContext, TEvent extends ImmerUpdateEvent>(
  type: TEvent['type'],
  producer: (ctx: Draft<TContext>, input: TEvent['input']) => void,
  validate?: (ctx: TContext, input: TEvent['input']) => boolean
): ImmerUpdater<TContext, TEvent> {
  const update = (input: TEvent['input']): TEvent => {
    return {
      type,
      input
    } as TEvent;
  };

  return {
    update,
    assign: immerAssign<TContext, TEvent>((ctx, event) => {
      producer(ctx, event.input);
    }),
    validate,
    type
  };
}
