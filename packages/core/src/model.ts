import {
  ActionObject,
  AssignAction,
  Assigner,
  PropertyAssigner,
  assign
} from '.';
import { EventObject } from './types';

export interface ContextModel<TC, TE extends EventObject> {
  context: TC;
  actions: {
    [key: string]: ActionObject<TC, TE>;
  };
  assign: <TEventType extends TE['type'] = TE['type']>(
    assigner:
      | Assigner<TC, TE & { type: TEventType }>
      | PropertyAssigner<TC, TE & { type: TEventType }>,
    eventType?: TEventType
  ) => AssignAction<TC, TE & { type: TEventType }>;
}

export function createModel<TContext, TEvent extends EventObject>(
  initialState: TContext
): ContextModel<TContext, TEvent> {
  const model: ContextModel<TContext, TEvent> = {
    context: initialState,
    actions: {},
    assign
  };

  return model;
}

export function assertEvent<TE extends EventObject, TType extends TE['type']>(
  event: TE,
  type: TType
): event is TE & { type: TType } {
  return event.type === type;
}
