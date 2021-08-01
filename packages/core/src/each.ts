import {
  EventObject,
  SingleOrArray,
  MachineContext,
  BaseActionObject
} from './types';

export function each<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  collection: keyof TContext,
  item: keyof TContext,
  actions: SingleOrArray<BaseActionObject>
): BaseActionObject;
export function each<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  collection: keyof TContext,
  item: keyof TContext,
  index: keyof TContext,
  actions: SingleOrArray<BaseActionObject>
): BaseActionObject;
export function each<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  collection: keyof TContext,
  item: keyof TContext,
  indexOrActions: keyof TContext | SingleOrArray<BaseActionObject>,
  maybeActions?: SingleOrArray<BaseActionObject>
): BaseActionObject {
  const actions = maybeActions || indexOrActions;
  const index = maybeActions ? indexOrActions : undefined;

  return {
    type: 'xstate.foreach',
    params: {
      collection,
      item,
      index,
      actions
    }
  };
}
