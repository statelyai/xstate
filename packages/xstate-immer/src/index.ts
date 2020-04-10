import {
  EventObject,
  ActionObject,
  AssignAction,
  assign as xstateAssign
} from 'xstate';
import { produce, Draft, produceWithPatches, applyPatches } from 'immer';

export type ImmerAssigner<TContext, TEvent extends EventObject> = (
  context: Draft<TContext>,
  event: TEvent
) => void;

export interface ImmerAssignAction<TContext, TEvent extends EventObject>
  extends ActionObject<TContext, TEvent> {
  assignment: ImmerAssigner<TContext, TEvent>;
}

export function assign<TContext, TEvent extends EventObject = EventObject>(
  assignment: ImmerAssigner<TContext, TEvent>
): AssignAction<TContext, TEvent> {
  // @ts-ignore (possibly infinite TS bug)
  return xstateAssign((context, event) => {
    return produce(context, (draft) => void assignment(draft, event));
  });
}

interface PatchEventObject extends EventObject {
  patches: ReturnType<typeof produceWithPatches>;
}

export function patchEvent<TContext>(
  type: string,
  context: TContext,
  recipe: (draftContext: TContext) => void
): PatchEventObject {
  return {
    type,
    patches: produceWithPatches(context, recipe)
  };
}

export function assignPatch<
  TContext,
  TEvent extends PatchEventObject
>(): AssignAction<TContext, TEvent> {
  return xstateAssign((context, event) => {
    const [, patches] = event.patches;

    return applyPatches(context, patches);
  });
}
