import {
  EventObject,
  StateValue,
  StateNode,
  TransitionDefinition,
  Snapshot,
  MachineContext,
  ActorLogic,
  MachineSnapshot,
  ParameterizedObject,
  StateNodeConfig,
  TODO,
  TransitionConfig
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
    /** The edges representing all transitions from this `stateNode`. */
    edges: DirectedGraphEdge[];
  },
  {
    id: string;
    children: DirectedGraphNode[];
  }
>;

export interface ValueAdjacencyMap<TState, TEvent extends EventObject> {
  [stateId: SerializedSnapshot]: Record<
    SerializedSnapshot,
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
  /** The target state. */
  state: TSnapshot;
  /** The paths that reach the target state. */
  paths: Array<StatePath<TSnapshot, TEvent>>;
}

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
  /** The event that resulted in the current state */
  event: TEvent;
  /** The current state after taking the event. */
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
  vertices: Set<SerializedSnapshot>;
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
  TEvent extends EventObject,
  TInput
> = {
  input?: TInput;
} & SerializationOptions<TSnapshot, TEvent> &
  Partial<
    Pick<
      TraversalConfig<TSnapshot, TEvent>,
      'events' | 'limit' | 'fromState' | 'stopWhen' | 'toState'
    >
  >;

export interface TraversalConfig<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends SerializationConfig<TSnapshot, TEvent> {
  events: readonly TEvent[] | ((state: TSnapshot) => readonly TEvent[]);
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

export type SerializedSnapshot = Brand<string, 'state'>;
export type SerializedEvent = Brand<string, 'event'>;

// XState Test

export type GetPathsOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = Partial<
  TraversalOptions<TSnapshot, TEvent, TInput> & {
    pathGenerator?: PathGenerator<TSnapshot, TEvent, TInput>;
  }
>;

export interface TestStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends Pick<
    StateNodeConfig<
      TContext,
      TEvent,
      TODO,
      TODO,
      ParameterizedObject,
      TODO,
      TODO,
      TODO,
      TODO, // emitted
      TODO // meta
    >,
    | 'type'
    | 'history'
    | 'on'
    | 'onDone'
    | 'entry'
    | 'exit'
    | 'meta'
    | 'always'
    | 'output'
    | 'id'
    | 'tags'
    | 'description'
  > {
  initial?: string;
  states?: Record<string, TestStateNodeConfig<TContext, TEvent>>;
}

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
export interface TestStepResult {
  step: Step<any, any>;
  state: TestStateResult;
  event: {
    error: null | Error;
  };
}

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
      { type: ExtractEvent<TEvent, TEventType>['type'] }
    >;
  };
}

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
export interface TestPathResult {
  steps: TestStepResult[];
  state: TestStateResult;
}

export type StatePredicate<TState> = (state: TState) => boolean;
/**
 * Executes an effect using the `testContext` and `event` that triggers the
 * represented `event`.
 */
export type EventExecutor<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = (step: Step<TSnapshot, TEvent>) => Promise<any> | void;

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

export interface TestTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTestContext
> extends TransitionConfig<
    TContext,
    TEvent,
    TEvent,
    TODO,
    TODO,
    TODO,
    string,
    TODO, // TEmitted
    TODO // TMeta
  > {
  test?: (
    state: MachineSnapshot<
      TContext,
      TEvent,
      any,
      any,
      any,
      any,
      any, // TMeta
      any // TStateSchema
    >,
    testContext: TTestContext
  ) => void;
}

export type TestTransitionsConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTestContext
> = {
  [K in TEvent['type'] | '' | '*']?: K extends '' | '*'
    ? TestTransitionConfig<TContext, TEvent, TTestContext> | string
    :
        | TestTransitionConfig<TContext, ExtractEvent<TEvent, K>, TTestContext>
        | string;
};

export type PathGenerator<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = (
  behavior: ActorLogic<TSnapshot, TEvent, TInput>,
  options: TraversalOptions<TSnapshot, TEvent, TInput>
) => Array<StatePath<TSnapshot, TEvent>>;
