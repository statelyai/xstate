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
  TE extends EventObject = GetEvents<TEM>
> = TEM extends any
  ? {
      [K in keyof TEM]: (
        ...args: Parameters<TEM[K]>
      ) => TE extends { type: K } ? TE : never;
    }
  : never;

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type Distribute<U, V extends Record<string, () => object>> = U extends keyof V &
  string
  ? Expand<{ type: U } & ReturnType<V[U]>>
  : never;

type GetEvents<T extends EventCreatorMap<any>> = Distribute<keyof T, T>;

export function createModel<TContext, TEvent extends EventObject>(
  initialContext: TContext
): Model<TContext, TEvent, never>;
export function createModel<
  TContext,
  TEM extends EventCreatorMap<any>,
  TEvent extends EventObject = GetEvents<TEM>
>(initialContext: TContext, eventCreators: TEM): Model<TContext, TEvent, TEM>;
export function createModel<
  TContext,
  TEM extends EventCreatorMap<any>,
  TEvent extends EventObject = GetEvents<TEM>
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
