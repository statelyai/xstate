import {
  State,
  EventObject,
  StateValue,
  StateNode,
  Condition,
  Action,
  MetaObject,
  TransitionDefinition
} from 'xstate';

export interface TransitionMap {
  state: StateValue | undefined;
}

export interface AdjacencyMap<TContext, TEvent extends EventObject> {
  [stateId: string]: Record<
    string,
    {
      state: State<TContext, TEvent>;
      event: TEvent;
    }
  >;
}

export interface Edge<
  TContext,
  TEvent extends EventObject,
  TEventType extends TEvent['type'] = string
> {
  event: TEventType;
  source: StateNode<TContext, any, TEvent>;
  target: StateNode<TContext, any, TEvent>;
  cond?: Condition<
    TContext,
    TEvent & {
      type: TEventType;
    }
  >;
  actions: Array<Action<TContext, TEvent>>;
  meta?: MetaObject;
  transition: TransitionDefinition<TContext, TEvent>;
}

export interface PathsItem<TContext, TEvent extends EventObject> {
  state: State<TContext, TEvent>;
  paths: Array<Path<TContext, TEvent>>;
}

export interface PathsMap<TContext, TEvent extends EventObject> {
  [key: string]: PathsItem<TContext, TEvent>;
}
export interface Segment<TContext, TEvent extends EventObject> {
  /**
   * The current state before taking the event.
   */
  state: State<TContext, TEvent>;
  /**
   * The event to be taken from the specified state.
   */
  event: TEvent;
}

export type Segments<TContext, TEvent extends EventObject> = Array<
  Segment<TContext, TEvent>
>;

export interface Path<TContext, TEvent extends EventObject> {
  /**
   * The ending state of the path.
   */
  state: State<TContext, TEvent>;
  /**
   * The ordered array of state-event pairs (segments) which reach the ending `state`.
   */
  segments: Segments<TContext, TEvent>;
  /**
   * The combined weight of all segments in the path.
   */
  weight: number;
}

export interface PathItem<TContext, TEvent extends EventObject> {
  state: State<TContext, TEvent>;
  path: Segments<TContext, TEvent>;
  weight?: number;
}

export interface PathMap<TContext, TEvent extends EventObject> {
  [key: string]: PathItem<TContext, TEvent>;
}
