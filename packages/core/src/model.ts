import { assign } from './actions';
import type {
  AssignAction,
  Assigner,
  PropertyAssigner,
  ExtractEvent,
  EventObject
} from './types';

export interface ContextModel<TContext, TEvent extends EventObject> {
  initialContext: TContext;
  assign: <TEventType extends TEvent['type'] = TEvent['type']>(
    assigner:
      | Assigner<TContext, ExtractEvent<TEvent, TEventType>>
      | PropertyAssigner<TContext, ExtractEvent<TEvent, TEventType>>,
    eventType?: TEventType
  ) => AssignAction<TContext, ExtractEvent<TEvent, TEventType>>;
}

export function createModel<TContext, TEvent extends EventObject>(
  initialContext: TContext
): ContextModel<TContext, TEvent> {
  const model: ContextModel<TContext, TEvent> = {
    initialContext,
    assign
  };

  return model;
}

export function assertEvent<
  TEvent extends EventObject,
  TEventType extends TEvent['type']
>(event: TEvent, type: TEventType): event is TEvent & { type: TEventType } {
  return event.type === type;
}
