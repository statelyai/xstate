import { ActionObject } from '.';
import { assign } from './actions';
import type {
  AssignAction,
  Assigner,
  PropertyAssigner,
  ExtractEvent,
  EventObject
} from './types';
import { mapValues } from './utils';

type AnyFunction = (...args: any[]) => any;

type Cast<A1 extends any, A2 extends any> = A1 extends A2 ? A1 : A2;
type Compute<A extends any> = { [K in keyof A]: A[K] } & unknown;
type Prop<T, K> = K extends keyof T ? T[K] : never;

export interface Model<
  TContext,
  TEvent extends EventObject,
  _TActions extends ActionObject<TContext, TEvent>,
  TModelCreators extends FinalModelCreators<any>
> {
  initialContext: TContext;
  assign: <TEventType extends TEvent['type'] = TEvent['type']>(
    assigner:
      | Assigner<TContext, ExtractEvent<TEvent, TEventType>>
      | PropertyAssigner<TContext, ExtractEvent<TEvent, TEventType>>,
    eventType?: TEventType
  ) => AssignAction<TContext, ExtractEvent<TEvent, TEventType>>;
  events: Prop<TModelCreators, 'events'>;
  actions: Prop<TModelCreators, 'actions'>;
  reset: () => AssignAction<TContext, any>;
}

export type ModelContextFrom<
  TModel extends Model<any, any, any, any>
> = TModel extends Model<infer TContext, any, any, any> ? TContext : never;

export type ModelEventsFrom<
  TModel extends Model<any, any, any, any> | undefined
> = TModel extends Model<any, infer TEvent, any, any> ? TEvent : EventObject;

export type ModelActionsFrom<
  TModel extends Model<any, any, any, any>
> = TModel extends Model<any, any, infer TActions, any> ? TActions : never;

type EventCreator<
  Self extends AnyFunction,
  Return = ReturnType<Self>
> = Return extends object
  ? Return extends {
      type: any;
    }
    ? "An event creator can't return an object with a type property"
    : Self
  : 'An event creator must return an object';

type EventCreators<Self> = {
  [K in keyof Self]: Self[K] extends AnyFunction
    ? EventCreator<Self[K]>
    : 'An event creator must be a function';
};

type ModelCreators<Self> = {
  events?: EventCreators<Prop<Self, 'events'>>;
  actions?: EventCreators<Prop<Self, 'actions'>>;
};

type FinalEventCreators<Self> = {
  [K in keyof Self]: Self[K] extends AnyFunction
    ? (
        ...args: Parameters<Self[K]>
      ) => Compute<ReturnType<Self[K]> & { type: K }>
    : never;
};

type FinalModelCreators<Self> = {
  events: FinalEventCreators<Prop<Self, 'events'>>;
  actions: FinalEventCreators<Prop<Self, 'actions'>>;
};

type EventFromEventCreators<TEventCreators> = keyof TEventCreators extends never
  ? EventObject
  : {
      [K in keyof TEventCreators]: TEventCreators[K] extends AnyFunction
        ? ReturnType<TEventCreators[K]>
        : never;
    }[keyof TEventCreators];

export function createModel<TContext, TEvent extends EventObject>(
  initialContext: TContext
): Model<TContext, TEvent, any, any>;
export function createModel<
  TContext,
  TModelCreators extends ModelCreators<TModelCreators>,
  TFinalModelCreators extends FinalModelCreators<TModelCreators> = FinalModelCreators<TModelCreators>
>(
  initialContext: TContext,
  creators: TModelCreators
): Model<
  TContext,
  Prop<TFinalModelCreators, 'events'> extends never
    ? EventObject
    : Cast<
        EventFromEventCreators<Prop<TFinalModelCreators, 'events'>>,
        EventObject
      >,
  Prop<TFinalModelCreators, 'actions'> extends never
    ? ActionObject<TContext, any>
    : Cast<
        EventFromEventCreators<Prop<TFinalModelCreators, 'actions'>>,
        ActionObject<TContext, any>
      >,
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
      ? mapValues(actionCreators, (fn, eventType) => (...args: any[]) => ({
          ...fn(...args),
          type: eventType
        }))
      : undefined,
    reset: () => assign(initialContext)
  };

  return model;
}
