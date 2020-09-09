import {
  State,
  EventObject,
  StateValue,
  StateNode,
  TransitionDefinition
} from 'xstate';

export interface TransitionMap {
  state: StateValue | undefined;
}

export type JSONSerializable<T extends object, U> = T & {
  toJSON: () => U;
};

export type DigraphLabel = JSONSerializable<
  {
    [key: string]: any;
    text: string;
  },
  {
    text: string;
  }
>;

export type DirectedGraphEdge = JSONSerializable<
  {
    [key: string]: any;
    id: string;
    source: StateNode;
    target: StateNode;
    label: DigraphLabel;
    transition: TransitionDefinition<any, any>;
  },
  {
    source: string;
    target: string;
    label: ReturnType<DigraphLabel['toJSON']>;
  }
>;

// Based on https://www.eclipse.org/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html
export type DirectedGraphNode = JSONSerializable<
  {
    [key: string]: any;
    id: string;
    stateNode: StateNode;
    children: DirectedGraphNode[];
    /**
     * The edges representing all transitions from this `stateNode`.
     */
    edges: DirectedGraphEdge[];
  },
  {
    [key: string]: any;
    id: string;
    children: DirectedGraphNode[];
  }
>;

export interface AdjacencyMap<TContext, TEvent extends EventObject> {
  [stateId: string]: Record<
    string,
    {
      state: State<TContext, TEvent>;
      event: TEvent;
    }
  >;
}

export interface StatePaths<TContext, TEvent extends EventObject> {
  /**
   * The target state.
   */
  state: State<TContext, TEvent>;
  /**
   * The paths that reach the target state.
   */
  paths: Array<StatePath<TContext, TEvent>>;
}

export interface StatePath<TContext, TEvent extends EventObject> {
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

export interface StatePathsMap<TContext, TEvent extends EventObject> {
  [key: string]: StatePaths<TContext, TEvent>;
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

export interface ValueAdjMapOptions<TContext, TEvent extends EventObject> {
  events: { [K in TEvent['type']]?: Array<TEvent & { type: K }> };
  filter: (state: State<TContext, any>) => boolean;
  stateSerializer: (state: State<TContext, any>) => string;
  eventSerializer: (event: TEvent) => string;
}
