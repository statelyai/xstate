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
  TModelCreators = never
> {
  initialContext: TContext;
  assign: <TEventType extends TEvent['type'] = TEvent['type']>(
    assigner:
      | Assigner<TContext, ExtractEvent<TEvent, TEventType>>
      | PropertyAssigner<TContext, ExtractEvent<TEvent, TEventType>>,
    eventType?: TEventType
  ) => AssignAction<TContext, ExtractEvent<TEvent, TEventType>>;
  events: Prop<TModelCreators, 'events'>;
  reset: () => AssignAction<TContext, any>;
}

export type ModelContextFrom<
  TModel extends Model<any, any, any>
> = TModel extends Model<infer TContext, any, any> ? TContext : never;

export type ModelEventsFrom<
  TModel extends Model<any, any, any>
> = TModel extends Model<any, infer TEvent, any> ? TEvent : never;

type EventCreators<Self> = {
  [K in keyof Self]: Self[K] extends AnyFunction
    ? ReturnType<Self[K]> extends { type: any }
      ? "You can't return a type property from an event creator"
      : Self[K]
    : 'An event creator must be a function';
};

type ModelCreators<Self> = {
  events: EventCreators<Prop<Self, 'events'>>;
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
};

type EventFromEventCreators<EventCreators> = {
  [K in keyof EventCreators]: EventCreators[K] extends AnyFunction
    ? ReturnType<EventCreators[K]>
    : never;
}[keyof EventCreators];

export function createModel<TContext, TEvent extends EventObject>(
  initialContext: TContext
): Model<TContext, TEvent, never>;
export function createModel<
  TContext,
  TModelCreators extends ModelCreators<TModelCreators>,
  TFinalModelCreators = FinalModelCreators<TModelCreators>
>(
  initialContext: TContext,
  creators: TModelCreators
): Model<
  TContext,
  Cast<
    EventFromEventCreators<Prop<TFinalModelCreators, 'events'>>,
    EventObject
  >,
  TFinalModelCreators
>;
export function createModel(initialContext: object, creators?) {
  const eventCreators = creators?.events;

  const model: Model<any, any, any> = {
    initialContext,
    assign,
    events: (eventCreators
      ? mapValues(eventCreators, (fn, eventType) => (...args: any[]) => ({
          ...fn(...args),
          type: eventType
        }))
      : undefined) as any,
    reset: () => assign(initialContext)
  };

  return model;
}
