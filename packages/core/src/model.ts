import { assign } from './actions';
import { createMachine } from './Machine';
import type {
  Cast,
  EventObject,
  BaseActionObject,
  Prop,
  IsNever
} from './types';
import { mapValues } from './utils';
import {
  UnionFromCreatorsReturnTypes,
  FinalModelCreators,
  Model,
  ModelCreators
} from './model.types';

/**
 * @deprecated Use [Typegen](https://stately.ai/blog/introducing-typescript-typegen-for-xstate) instead.
 */
export function createModel<
  TContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject
>(initialContext: TContext): Model<TContext, TEvent, TAction, void>;
export function createModel<
  TContext,
  TModelCreators extends ModelCreators<TModelCreators>,
  TFinalModelCreators = FinalModelCreators<TModelCreators>,
  TComputedEvent = UnionFromCreatorsReturnTypes<
    Prop<TFinalModelCreators, 'events'>
  >,
  TComputedAction = UnionFromCreatorsReturnTypes<
    Prop<TFinalModelCreators, 'actions'>
  >
>(
  initialContext: TContext,
  creators: TModelCreators
): Model<
  TContext,
  Cast<TComputedEvent, EventObject>,
  IsNever<TComputedAction> extends true
    ? BaseActionObject
    : Cast<TComputedAction, BaseActionObject>,
  TFinalModelCreators
>;
export function createModel(
  initialContext: object,
  creators?: ModelCreators<any>
): unknown {
  const eventCreators = creators?.events;
  const actionCreators = creators?.actions;

  const model: Model<any, any, any, any> = {
    initialContext,
    assign,
    events: (eventCreators
      ? mapValues(eventCreators, (fn, eventType) => (...args: any[]) => ({
          ...fn(...args),
          type: eventType
        }))
      : undefined) as any,
    actions: actionCreators
      ? mapValues(actionCreators, (fn, actionType) => (...args: any[]) => ({
          ...fn(...args),
          type: actionType
        }))
      : undefined,
    reset: () => assign(initialContext),
    createMachine: (config, implementations) => {
      return createMachine(
        'context' in config ? config : { ...config, context: initialContext },
        implementations
      );
    }
  };

  return model;
}
