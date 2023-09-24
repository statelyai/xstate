import {
  EventObject,
  StateValue,
  StateNode,
  TransitionDefinition,
  Snapshot
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

export interface StatePlan<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  /**
   * The target state.
   */
  state: TSnapshot;
  /**
   * The paths that reach the target state.
   */
  paths: Array<StatePath<TSnapshot, TEvent>>;
}

export interface StatePath<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  /**
   * The ending state of the path.
   */
  state: TSnapshot;
  /**
   * The ordered array of state-event pairs (steps) which reach the ending `state`.
   */
  steps: Steps<TSnapshot, TEvent>;
  /**
   * The combined weight of all steps in the path.
   */
  weight: number;
}

export interface StatePlanMap<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  [key: string]: StatePlan<TSnapshot, TEvent>;
}

export interface Step<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  /**
   * The event that resulted in the current state
   */
  event: TEvent;
  /**
   * The current state after taking the event.
   */
  state: TSnapshot;
}

export type Steps<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = Array<Step<TSnapshot, TEvent>>;

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
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  serializeState: (
    state: TSnapshot,
    event: TEvent | undefined,
    prevState?: TSnapshot
  ) => string;
  serializeEvent: (event: TEvent) => string;
}

export type SerializationOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = Partial<
  Pick<
    SerializationConfig<TSnapshot, TEvent>,
    'serializeState' | 'serializeEvent'
  >
>;

export type TraversalOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = SerializationOptions<TSnapshot, TEvent> &
  Partial<
    Pick<
      TraversalConfig<TSnapshot, TEvent>,
      | 'filter'
      | 'events'
      | 'traversalLimit'
      | 'fromState'
      | 'stopCondition'
      | 'toState'
    >
  >;

export interface TraversalConfig<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends SerializationConfig<TSnapshot, TEvent> {
  /**
   * Determines whether to traverse a transition from `state` on
   * `event` when building the adjacency map.
   */
  filter: (state: TSnapshot, event: TEvent) => boolean;
  events: readonly TEvent[] | ((state: TSnapshot) => readonly TEvent[]);
  /**
   * The maximum number of traversals to perform when calculating
   * the state transition adjacency map.
   *
   * @default `Infinity`
   */
  traversalLimit: number;
  fromState: TSnapshot | undefined;
  /**
   * When true, traversal of the adjacency map will stop
   * for that current state.
   */
  stopCondition: ((state: TSnapshot) => boolean) | undefined;
  toState: ((state: TSnapshot) => boolean) | undefined;
}

type Brand<T, Tag extends string> = T & { __tag: Tag };

export type SerializedState = Brand<string, 'state'>;
export type SerializedEvent = Brand<string, 'event'>;
