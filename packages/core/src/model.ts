import { assign } from './actions';
import type {
  AssignAction,
  Assigner,
  PropertyAssigner,
  ExtractEvent,
  EventObject
} from './types';
import { mapValues } from './utils';

export interface ContextModel<
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
  types: {
    context: TContext;
    events: TEvent;
  };
  reset: () => AssignAction<TContext, any>;
}

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
): ContextModel<TContext, TEvent, never>;
export function createModel<
  TContext,
  TEM extends EventCreatorMap<any>,
  TEvent extends EventObject = GetEvents<TEM>
>(
  initialContext: TContext,
  eventCreators: TEM
): ContextModel<TContext, TEvent, TEM>;
export function createModel<
  TContext,
  TEM extends EventCreatorMap<any>,
  TEvent extends EventObject = GetEvents<TEM>
>(initialContext: TContext, eventCreators?) {
  const model: ContextModel<TContext, TEvent, TEM> = {
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
    types: {} as any,
    reset: () => assign(initialContext)
  };

  return model;
}
