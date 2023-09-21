import {
  EventObject,
  StateValue,
  StateNode,
  TransitionDefinition,
  ActorInternalState
} from 'xstate';

export type AnyStateNode = StateNode<any, any>;

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

export interface StatePath<TInternalState, TEvent extends EventObject> {
  /**
   * The ending state of the path.
   */
  state: TInternalState;
  /**
   * The ordered array of state-event pairs (steps) which reach the ending `state`.
   */
  steps: Steps<TInternalState, TEvent>;
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
   * The event that resulted in the current state
   */
  event: TEvent;
  /**
   * The current state after taking the event.
   */
  state: TState;
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

export interface SerializationConfig<
  TInternalState extends ActorInternalState<any, any>,
  TEvent extends EventObject
> {
  serializeState: (
    state: TInternalState,
    event: TEvent | undefined,
    prevState?: TInternalState
  ) => string;
  serializeEvent: (event: TEvent) => string;
}

export type SerializationOptions<
  TInternalState extends ActorInternalState<any, any>,
  TEvent extends EventObject
> = Partial<
  Pick<
    SerializationConfig<TInternalState, TEvent>,
    'serializeState' | 'serializeEvent'
  >
>;

export type TraversalOptions<
  TInternalState extends ActorInternalState<any, any>,
  TEvent extends EventObject
> = SerializationOptions<TInternalState, TEvent> &
  Partial<
    Pick<
      TraversalConfig<TInternalState, TEvent>,
      | 'filter'
      | 'events'
      | 'traversalLimit'
      | 'fromState'
      | 'stopCondition'
      | 'toState'
    >
  >;

export interface TraversalConfig<
  TInternalState extends ActorInternalState<any, any>,
  TEvent extends EventObject
> extends SerializationConfig<TInternalState, TEvent> {
  /**
   * Determines whether to traverse a transition from `state` on
   * `event` when building the adjacency map.
   */
  filter: (state: TInternalState['snapshot'], event: TEvent) => boolean;
  events:
    | readonly TEvent[]
    | ((state: TInternalState['snapshot']) => readonly TEvent[]);
  /**
   * The maximum number of traversals to perform when calculating
   * the state transition adjacency map.
   *
   * @default `Infinity`
   */
  traversalLimit: number;
  fromState: TInternalState | undefined;
  /**
   * When true, traversal of the adjacency map will stop
   * for that current state.
   */
  stopCondition: ((state: TInternalState['snapshot']) => boolean) | undefined;
  toState: ((state: TInternalState['snapshot']) => boolean) | undefined;
}

type Brand<T, Tag extends string> = T & { __tag: Tag };

export type SerializedState = Brand<string, 'state'>;
export type SerializedEvent = Brand<string, 'event'>;
