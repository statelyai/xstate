import { assign } from './actions';
import type {
  AssignAction,
  Assigner,
  PropertyAssigner,
  ExtractEvent,
  EventObject
} from './types';
import { mapValues } from './utils';

export interface Model<
  TContext,
  TEvent extends EventObject,
  TEM extends EventCreatorMap<TEvent> = EventCreatorMap<TEvent>
> {
  initialContext: TContext;
  assign: <TEventType extends TEvent['type'] = TEvent['type']>(
    assigner:
      | Assigner<TContext, ExtractEvent<TEvent, TEventType>>
      | PropertyAssigner<TContext, ExtractEvent<TEvent, TEventType>>,
    eventType?: TEventType
  ) => AssignAction<TContext, ExtractEvent<TEvent, TEventType>>;
  events: FullEventCreatorMap<TEM>;
  reset: () => AssignAction<TContext, any>;
}

export type ModelContextFrom<
  TModel extends Model<any, any>
> = TModel extends Model<infer TContext, any> ? TContext : never;

export type ModelEventsFrom<
  TModel extends Model<any, any>
> = TModel extends Model<any, infer TEvent> ? TEvent : never;

type EventCreatorMap<TEvent extends EventObject> = {
  [key in TEvent['type']]: (
    ...args: any[]
  ) => Omit<TEvent & { type: key }, 'type'>;
};

type FullEventCreatorMap<
  TEM extends EventCreatorMap<any>,
  TE extends EventObject = GetEventsFromEventCreatorMap<TEM>
> = TEM extends any
  ? {
      [K in keyof TEM]: (
        ...args: Parameters<TEM[K]>
      ) => TE extends { type: K } ? TE : never;
    }
  : never;

type Expand<A extends any> = { [K in keyof A]: A[K] } & unknown;

// This turns an object like: {
//   foo: (bar: string) => ({ bar }),
//   baz: () => ({})
// }
// into this:
// { type: 'foo', bar: string } | { type: 'baz' }
type Distribute<
  TKey,
  TMapping extends { [TEventType in string]: () => object }
> = TKey extends keyof TMapping & string
  ? Expand<{ type: TKey } & ReturnType<TMapping[TKey]>>
  : never;

type GetEventsFromEventCreatorMap<T extends EventCreatorMap<any>> = Distribute<
  keyof T,
  T
>;

export function createModel<TContext, TEvent extends EventObject>(
  initialContext: TContext
): Model<TContext, TEvent, never>;
export function createModel<
  TContext,
  TEM extends EventCreatorMap<any>,
  TEvent extends EventObject = GetEventsFromEventCreatorMap<TEM>
>(initialContext: TContext, eventCreators: TEM): Model<TContext, TEvent, TEM>;
export function createModel<
  TContext,
  TEM extends EventCreatorMap<any>,
  TEvent extends EventObject = GetEventsFromEventCreatorMap<TEM>
>(initialContext: TContext, eventCreators?) {
  const model: Model<TContext, TEvent, TEM> = {
    initialContext,
    assign,
    events: (eventCreators
      ? mapValues(
          eventCreators,
          (fn, eventType) => (...args: Parameters<typeof fn>) => ({
            type: eventType,
            ...fn(...args)
          })
        )
      : undefined) as FullEventCreatorMap<TEM>,
    reset: () => assign(initialContext)
  };

  return model;
}
