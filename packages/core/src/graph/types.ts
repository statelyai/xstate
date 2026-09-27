import {
  EventObject,
  StateNode,
  TransitionDefinition,
  Snapshot,
  MachineContext,
  ActorLogic,
  MachineSnapshot
} from '..';

/** @public */
export type AnyStateNode = StateNode<any, any>;

type JSONSerializable<T extends object, U> = T & {
  toJSON: () => U;
};

type DirectedGraphLabel = JSONSerializable<
  {
    text: string;
  },
  {
    text: string;
  }
>;

/** @public */
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
/** @public */
export type DirectedGraphNode = JSONSerializable<
  {
    id: string;
    stateNode: StateNode;
    children: DirectedGraphNode[];
    /** The edges representing all transitions from this `stateNode`. */
    edges: DirectedGraphEdge[];
  },
  {
    id: string;
    children: DirectedGraphNode[];
  }
>;

interface StatePlan<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  /** The target state. */
  state: TSnapshot;
  /** The paths that reach the target state. */
  paths: Array<StatePath<TSnapshot, TEvent>>;
}

/** @public */
export interface StatePath<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  /** The ending state of the path. */
  state: TSnapshot;
  /**
   * The ordered array of state-event pairs (steps) which reach the ending
   * `state`.
   */
  steps: Steps<TSnapshot, TEvent>;
  /** The combined weight of all steps in the path. */
  weight: number;
}

/** @public */
export interface StatePlanMap<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  [key: string]: StatePlan<TSnapshot, TEvent>;
}

/** @public */
export interface Step<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  /** The event that resulted in the current state */
  event: TEvent;
  /** The current state after taking the event. */
  state: TSnapshot;
}

/** @public */
export type Steps<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = Array<Step<TSnapshot, TEvent>>;

type ExtractEvent<
  TEvent extends EventObject,
  TType extends TEvent['type']
> = TEvent extends { type: TType } ? TEvent : never;

/** @public */
export interface VisitedContext<TState, TEvent> {
  vertices: Set<SerializedSnapshot>;
  edges: Set<SerializedEvent>;
  a?: TState | TEvent; // TODO: remove
}

/** @public */
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

type SerializationOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = Partial<
  Pick<
    SerializationConfig<TSnapshot, TEvent>,
    'serializeState' | 'serializeEvent'
  >
>;

/** @public */
export type TraversalOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = {
  input?: TInput;
} & SerializationOptions<TSnapshot, TEvent> &
  Partial<
    Pick<
      TraversalConfig<TSnapshot, TEvent>,
      'events' | 'filterEvents' | 'limit' | 'fromState' | 'stopWhen' | 'toState'
    >
  >;

/** @public */
export interface TraversalConfig<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends SerializationConfig<TSnapshot, TEvent> {
  events: readonly TEvent[] | ((state: TSnapshot) => readonly TEvent[]);
  filterEvents: ((snapshot: TSnapshot, event: TEvent) => boolean) | undefined;
  /**
   * The maximum number of traversals to perform when calculating the state
   * transition adjacency map.
   *
   * @default `Infinity`
   */
  limit: number;
  fromState: TSnapshot | undefined;
  /** When true, traversal of the adjacency map will stop for that current state. */
  stopWhen: ((state: TSnapshot) => boolean) | undefined;
  toState: ((state: TSnapshot) => boolean) | undefined;
}

type Brand<T, Tag extends string> = T & { __tag: Tag };

/** @public */
export type SerializedSnapshot = Brand<string, 'state'>;
/** @public */
export type SerializedEvent = Brand<string, 'event'>;

/** @public */
export interface TestMeta<T, TContext extends MachineContext> {
  test?: (
    testContext: T,
    state: MachineSnapshot<
      TContext,
      any,
      any,
      any,
      any,
      any,
      any, // TMeta
      any // TStateSchema
    >
  ) => Promise<void> | void;
  description?:
    | string
    | ((
        state: MachineSnapshot<
          TContext,
          any,
          any,
          any,
          any,
          any,
          any, // TMeta
          any // TStateSchema
        >
      ) => string);
  skip?: boolean;
}
interface TestStateResult {
  error: null | Error;
}
/** @public */
export interface TestStepResult {
  step: Step<any, any>;
  state: TestStateResult;
  event: {
    error: null | Error;
  };
}

/** @public */
export interface TestParam<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  states?: {
    [key: string]: (state: TSnapshot) => void | Promise<void>;
  };
  events?: {
    [TEventType in TEvent['type']]?: EventExecutor<
      TSnapshot,
      ExtractEvent<TEvent, TEventType>
    >;
  };
}

/** @public */
export interface TestPath<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends StatePath<TSnapshot, TEvent> {
  description: string;
  /**
   * Tests and executes each step in `steps` sequentially, and then tests the
   * postcondition that the `state` is reached.
   */
  test: (params: TestParam<TSnapshot, TEvent>) => Promise<TestPathResult>;
}
/** @public */
export interface TestPathResult {
  steps: TestStepResult[];
  state: TestStateResult;
}

/**
 * Executes an effect using the `testContext` and `event` that triggers the
 * represented `event`.
 *
 * @public
 */
export type EventExecutor<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = (step: Step<TSnapshot, TEvent>) => Promise<any> | void;

/** @public */
export interface TestModelOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> extends TraversalOptions<TSnapshot, TEvent, TInput> {
  stateMatcher: (state: TSnapshot, stateKey: string) => boolean;
  logger: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
  serializeTransition: (
    state: TSnapshot,
    event: TEvent | undefined,
    prevState?: TSnapshot
  ) => string;
}

/** @public */
export type PathGenerator<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = (
  behavior: ActorLogic<TSnapshot, TEvent, TInput>,
  options: TraversalOptions<TSnapshot, TEvent, TInput>
) => Array<StatePath<TSnapshot, TEvent>>;

/** @public */
export interface AdjacencyValue<TState, TEvent> {
  state: TState;
  transitions: {
    [key: SerializedEvent]: {
      event: TEvent;
      state: TState;
    };
  };
}

/** @public */
export interface AdjacencyMap<TState, TEvent> {
  [key: SerializedSnapshot]: AdjacencyValue<TState, TEvent>;
}
