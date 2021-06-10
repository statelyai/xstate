import {
  Cast,
  createModel as xstateCreate,
  EventFromEventCreators,
  FinalModelCreators,
  Model as XStateModel,
  ModelCreators,
  Prop
} from 'xstate/lib/model';
import { assign, ImmerAssignAction, ImmerAssigner } from './';
import { EventObject, ExtractEvent } from 'xstate';

export interface ImmerModel<
  TContext,
  TEvent extends EventObject,
  TModelCreators = void
> extends Omit<XStateModel<TContext, TEvent, TModelCreators>, 'assign'> {
  assign: <TEventType extends TEvent['type'] = TEvent['type']>(
    assigner: ImmerAssigner<TContext, ExtractEvent<TEvent, TEventType>>,
    eventType?: TEventType
  ) => ImmerAssignAction<TContext, ExtractEvent<TEvent, TEventType>>;
}

export function createModel<TContext, TEvent extends EventObject>(
  initialContext: TContext
): ImmerModel<TContext, TEvent, void>;
export function createModel<
  TContext,
  TModelCreators extends ModelCreators<TModelCreators>,
  TFinalModelCreators = FinalModelCreators<TModelCreators>
>(
  initialContext: TContext,
  creators: TModelCreators
): ImmerModel<
  TContext,
  Cast<
    EventFromEventCreators<Prop<TFinalModelCreators, 'events'>>,
    EventObject
  >,
  TFinalModelCreators
>;
export function createModel(initialContext: object, creators?): unknown {
  const model = xstateCreate(initialContext, creators);

  return { ...model, assign };
}
