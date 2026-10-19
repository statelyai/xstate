import {
  EventObject,
  StateNode,
  TransitionDefinition,
  Snapshot,
  ActorLogic,
  AnyMachineSnapshot,
  DoneActorEvent,
  ErrorActorEvent,
  AfterEvent,
  AnyActorLogic,
  SnapshotFrom,
  EventFromLogic,
  InputFrom
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
  /**
   * Payload cases keyed by event type augment the machine's own events.
   * Each configured type needs a nonempty array, or a snapshot callback
   * returning one. Omit `type` from payloads. Unconfigured payload-free
   * events and synthetic invoke/delay events retain their defaults.
   * An event array or callback returning events replaces all defaults.
   */
  events?:
    | EventCases<TSnapshot, TEvent>
    | readonly TraversalEvent<TSnapshot, TEvent>[]
    | ((state: TSnapshot) => readonly TraversalEvent<TSnapshot, TEvent>[]);
} & SerializationOptions<TSnapshot, TEvent> &
  Partial<
    Pick<
      TraversalConfig<TSnapshot, TEvent>,
      'filterEvents' | 'limit' | 'fromState' | 'stopWhen' | 'toState'
    >
  >;

export type TraversalEvent<TSnapshot, TEvent> =
  | TEvent
  | (TSnapshot extends AnyMachineSnapshot
      ?
          | (Omit<DoneActorEvent, 'output' | 'sessionId'> &
              Partial<Pick<DoneActorEvent, 'output' | 'sessionId'>>)
          | (Omit<ErrorActorEvent, 'error' | 'sessionId'> &
              Partial<Pick<ErrorActorEvent, 'error' | 'sessionId'>>)
          | AfterEvent
      : never);

type RequiredEventTypes<TEvent extends EventObject> =
  string extends TEvent['type']
    ? never
    : {
        [TType in TEvent['type']]: { type: TType } extends TEvent & {
          type: TType;
        }
          ? never
          : TType;
      }[TEvent['type']];

type EventPayload<TEvent> = TEvent extends EventObject
  ? Omit<TEvent, 'type'>
  : never;

type EventCase<TSnapshot, TEvent> =
  | readonly [EventPayload<TEvent>, ...EventPayload<TEvent>[]]
  | ((
      state: TSnapshot
    ) => readonly [EventPayload<TEvent>, ...EventPayload<TEvent>[]]);

/** Payload samples keyed by event type. Required payloads need at least one case. */
export type EventCases<TSnapshot, TEvent extends EventObject> = {
  [TType in TEvent['type']]?: EventCase<TSnapshot, TEvent & { type: TType }>;
} & {
  [TType in RequiredEventTypes<TEvent>]-?: EventCase<
    TSnapshot,
    TEvent & { type: TType }
  >;
};

export type EventCaseOptions<TLogic extends AnyActorLogic> = Omit<
  TraversalOptions<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>,
    InputFrom<TLogic>
  >,
  'events'
> & { events?: EventCases<SnapshotFrom<TLogic>, EventFromLogic<TLogic>> };

export type EventCaseOptionsArgs<TLogic extends AnyActorLogic> = [
  RequiredEventTypes<EventFromLogic<TLogic>>
] extends [never]
  ? [options?: EventCaseOptions<TLogic>]
  : [
      options: EventCaseOptions<TLogic> & {
        events: EventCases<SnapshotFrom<TLogic>, EventFromLogic<TLogic>>;
      }
    ];

export type EventListOptions<
  TLogic extends AnyActorLogic,
  TEvents extends readonly TraversalEvent<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>
  >[]
> = Omit<EventCaseOptions<TLogic>, 'events'> & {
  events: TEvents | ((state: SnapshotFrom<TLogic>) => TEvents);
} & ([
    Exclude<RequiredEventTypes<EventFromLogic<TLogic>>, TEvents[number]['type']>
  ] extends [never]
    ? unknown
    : {
        [TType in Exclude<
          RequiredEventTypes<EventFromLogic<TLogic>>,
          TEvents[number]['type']
        > as `Missing event cases: ${TType}`]: never;
      });

/** @public */
export interface TraversalConfig<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> extends SerializationConfig<TSnapshot, TEvent> {
  /**
   * The events to send from each state, as a list or as a function of the
   * state. Defaults to the machine's own events for that state (see
   * `getAllOwnEvents`). A given value replaces the default, so invoke results
   * (`xstate.done.actor`, `xstate.error.actor`) and delays (`xstate.after`)
   * are traversed only if it includes them:
   *
   * ```ts
   * getShortestPaths(machine, {
   *   events: (snapshot) =>
   *     getAllOwnEvents(snapshot).map((event) =>
   *       event.type === 'SUBMIT' ? { type: 'SUBMIT', value: 'hello' } : event
   *     )
   * });
   * ```
   */
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
export type PathGenerator<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput
> = {
  <
    TLogic extends ActorLogic<TSnapshot, TEvent, TInput>,
    const _TEvents extends readonly TraversalEvent<
      SnapshotFrom<NoInfer<TLogic>>,
      EventFromLogic<NoInfer<TLogic>>
    >[]
  >(
    behavior: TLogic,
    options: Exclude<EventCaseOptionsArgs<NoInfer<TLogic>>[0], undefined> &
      TraversalOptions<TSnapshot, TEvent, TInput>
  ): Array<StatePath<SnapshotFrom<TLogic>, EventFromLogic<TLogic>>>;
  <
    TLogic extends ActorLogic<TSnapshot, TEvent, TInput>,
    const TEvents extends readonly TraversalEvent<
      SnapshotFrom<NoInfer<TLogic>>,
      EventFromLogic<NoInfer<TLogic>>
    >[]
  >(
    behavior: TLogic,
    options: EventListOptions<NoInfer<TLogic>, TEvents> &
      TraversalOptions<TSnapshot, TEvent, TInput>
  ): Array<StatePath<SnapshotFrom<TLogic>, EventFromLogic<TLogic>>>;
};

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
