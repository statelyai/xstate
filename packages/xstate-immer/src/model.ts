import {
  createModel as xstateCreate,
  Model as XStateModel
} from 'xstate/lib/model';
import { assign, ImmerAssignAction, ImmerAssigner } from './';
import { EventObject, ExtractEvent } from 'xstate';

type AnyFunction = (...args: any[]) => any;
type Cast<A1 extends any, A2 extends any> = A1 extends A2 ? A1 : A2;
type Compute<A extends any> = { [K in keyof A]: A[K] } & unknown;
type Prop<T, K> = K extends keyof T ? T[K] : never;

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

//this is the only thing that should actually need to be defined in this file. The above are not exported currently.

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
