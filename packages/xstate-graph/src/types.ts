import { EventObject, StateNode, TransitionDefinition } from 'xstate';

export type JSONSerializable<T extends object, U> = T & {
  toJSON: () => U;
};

export type DirectedGraphLabel = JSONSerializable<
  {
    text: string;
  },
  {
    text: string;
  }
>;

export type DirectedGraphEdge = JSONSerializable<
  {
    id: string;
    source: StateNode;
    target: StateNode;
    label: DirectedGraphLabel;
    transition: TransitionDefinition<any, any>;
  },
  {
    source: string;
    target: string;
    label: ReturnType<DirectedGraphLabel['toJSON']>;
  }
>;

// Based on https://www.eclipse.org/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html
export type DirectedGraphNode = JSONSerializable<
  {
    id: string;
    stateNode: StateNode;
    children: DirectedGraphNode[];
    /**
     * The edges representing all transitions from this `stateNode`.
     */
    edges: DirectedGraphEdge[];
  },
  {
    id: string;
    children: DirectedGraphNode[];
  }
>;

export interface AdjacencyMap<TState, TEvent extends EventObject> {
  [stateId: string]: Record<
    string,
    {
      state: TState;
      event: TEvent;
    }
  >;
}

export interface StatePaths<TState, TEvent extends EventObject> {
  /**
   * The target state.
   */
  state: TState;
  /**
   * The paths that reach the target state.
   */
  paths: Array<StatePath<TState, TEvent>>;
}

export interface StatePath<TState, TEvent extends EventObject> {
  /**
   * The ending state of the path.
   */
  state: TState;
  /**
   * The ordered array of state-event pairs (steps) which reach the ending `state`.
   */
  steps: Steps<TState, TEvent>;
  /**
   * The combined weight of all steps in the path.
   */
  weight: number;
}

export interface StatePathsMap<TState, TEvent extends EventObject> {
  [key: string]: StatePaths<TState, TEvent>;
}

export interface Step<TState, TEvent extends EventObject> {
  /**
   * The current state before taking the event.
   */
  state: TState;
  /**
   * The event to be taken from the specified state.
   */
  event: TEvent;
}

export type Steps<TState, TEvent extends EventObject> = Array<
  Step<TState, TEvent>
>;

export type ExtractEvent<
  TEvent extends EventObject,
  TType extends TEvent['type']
> = TEvent extends { type: TType } ? TEvent : never;

export interface ValueAdjMapOptions<TState, TEvent extends EventObject> {
  events?: {
    [K in TEvent['type']]?:
      | Array<ExtractEvent<TEvent, K>>
      | ((state: TState) => Array<ExtractEvent<TEvent, K>>);
  };
  filter?: (state: TState) => boolean;
  stateSerializer?: (state: TState) => string;
  eventSerializer?: (event: TEvent) => string;
}

export interface VisitedContext<TState, TEvent> {
  vertices: Set<SerializedState>;
  edges: Set<SerializedEvent>;
  a?: TState | TEvent; // TODO: remove
}

export interface TraversalOptions<V, E> {
  serializeState?: (vertex: V, edge: E | null) => SerializedState;
  visitCondition?: (vertex: V, edge: E, vctx: VisitedContext<V, E>) => boolean;
  filter?: (vertex: V, edge: E) => boolean;
}

type Brand<T, Tag extends string> = T & { __tag: Tag };

export type SerializedState = Brand<string, 'state'>;
export type SerializedEvent = Brand<string, 'event'>;
