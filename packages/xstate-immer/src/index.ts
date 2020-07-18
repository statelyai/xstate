import {
  EventObject,
  ActionObject,
  AssignAction,
  assign as xstateAssign,
  AssignMeta
} from 'xstate';
import { produce, Draft, Patch, enablePatches, applyPatches } from 'immer';

enablePatches();

export type ImmerAssigner<TContext, TEvent extends EventObject> = (
  context: Draft<TContext>,
  event: TEvent,
  meta: AssignMeta<TContext, TEvent>
) => void;

export interface ImmerAssignAction<TContext, TEvent extends EventObject>
  extends ActionObject<TContext, TEvent> {
  assignment: ImmerAssigner<TContext, TEvent>;
}

function immerAssign<TContext, TEvent extends EventObject = EventObject>(
  recipe: ImmerAssigner<TContext, TEvent>
): AssignAction<TContext, TEvent> {
  return xstateAssign((context, event, meta) => {
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

export interface ImmerUpdater<TContext, TEvent extends ImmerUpdateEvent> {
  update: (input: TEvent['input']) => TEvent;
  action: AssignAction<TContext, TEvent>;
  type: TEvent['type'];
}

export function createUpdater<TContext, TEvent extends ImmerUpdateEvent>(
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

const IMMER_PATCH_TYPE = '@immer.patch' as const;

export interface ImmerPatchEvent<K> {
  type: typeof IMMER_PATCH_TYPE;
  key: K;
  patches: Patch[];
}

export const createPatch = <T, K extends keyof T>(
  key: K
): {
  (currentValue: T[K], fn: (draft: Draft<T[K]>) => void): ImmerPatchEvent<K>;
  type: ImmerPatchEvent<K>['type'];
  action: AssignAction<T, ImmerPatchEvent<K>>;
  transition: Record<
    ImmerPatchEvent<K>['type'],
    { actions: Array<AssignAction<T, ImmerPatchEvent<K>>> }
  >;
} => {
  const applyPatch = (
    currentValue: T[K],
    fn: (draft: Draft<T[K]>) => void
  ): ImmerPatchEvent<K> => {
    const patches: Patch[] = [];

    produce(currentValue, fn, (resultPatches) => {
      patches.push(...resultPatches);
    });

    return {
      type: IMMER_PATCH_TYPE,
      key,
      patches
    };
  };

  const action = xstateAssign({
    [key as K]: (ctx: T, e: ImmerPatchEvent<K>) => {
      return applyPatches(ctx[key], e.patches);
    }
  }) as AssignAction<T, ImmerPatchEvent<K>>;

  applyPatch.type = IMMER_PATCH_TYPE;
  applyPatch.action = action;
  applyPatch.transition = { [IMMER_PATCH_TYPE]: { actions: [action] } };

  return applyPatch;
};
