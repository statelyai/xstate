import {
  EventObject,
  StateValue,
  StateNode,
  TransitionDefinition
} from 'xstate';

export type AnyStateNode = StateNode<any, any, any, any, any>;

export interface TransitionMap {
  state: StateValue | undefined;
}

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
    source: AnyStateNode;
    target: AnyStateNode;
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

export interface ValueAdjacencyMap<TState, TEvent extends EventObject> {
  [stateId: SerializedState]: Record<
    SerializedState,
    {
      state: TState;
      event: TEvent;
    }
  >;
}

export interface StatePlan<TState, TEvent extends EventObject> {
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

export interface StatePlanMap<TState, TEvent extends EventObject> {
  [key: string]: StatePlan<TState, TEvent>;
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

export interface ValueAdjacencyMapOptions<TState, TEvent extends EventObject> {
  events?: {
    [K in TEvent['type']]?:
      | Array<ExtractEvent<TEvent, K>>
      | ((state: TState) => Array<ExtractEvent<TEvent, K>>);
  };
  filter?: (state: TState) => boolean;
  serializeState?: (state: TState) => string;
  serializeEvent?: (event: TEvent) => string;
}

export interface VisitedContext<TState, TEvent> {
  vertices: Set<SerializedState>;
  edges: Set<SerializedEvent>;
  a?: TState | TEvent; // TODO: remove
}

export interface SerializationConfig<TState, TEvent extends EventObject> {
  serializeState: (
    state: TState,
    event: TEvent | undefined,
    prevState?: TState
  ) => string;
  serializeEvent: (event: TEvent) => string;
}

export type SerializationOptions<TState, TEvent extends EventObject> = Partial<
  Pick<SerializationConfig<TState, TEvent>, 'serializeState' | 'serializeEvent'>
>;

export type TraversalOptions<
  TState,
  TEvent extends EventObject
> = SerializationOptions<TState, TEvent> &
  Partial<
    Pick<
      TraversalConfig<TState, TEvent>,
      | 'filter'
      | 'events'
      | 'traversalLimit'
      | 'fromState'
      | 'stopCondition'
      | 'toState'
    >
  >;

export interface TraversalConfig<TState, TEvent extends EventObject>
  extends SerializationConfig<TState, TEvent> {
  /**
   * Determines whether to traverse a transition from `state` on
   * `event` when building the adjacency map.
   */
  filter: (state: TState, event: TEvent) => boolean;
  events: readonly TEvent[] | ((state: TState) => readonly TEvent[]);
  /**
   * The maximum number of traversals to perform when calculating
   * the state transition adjacency map.
   *
   * @default `Infinity`
   */
  traversalLimit: number;
  fromState: TState | undefined;
  /**
   * When true, traversal of the adjacency map will stop
   * for that current state.
   */
  stopCondition: ((state: TState) => boolean) | undefined;
  toState: ((state: TState) => boolean) | undefined;
}

type Brand<T, Tag extends string> = T & { __tag: Tag };

export type SerializedState = Brand<string, 'state'>;
export type SerializedEvent = Brand<string, 'event'>;

export interface SimpleBehavior<TState, TEvent> {
  transition: (state: TState, event: TEvent) => TState;
  initialState: TState;
}
