import { StandardSchemaV1 } from './schema.types.ts';
import { MachineSnapshot } from './State';
import {
  Action,
  ActorRef,
  AnyActorLogic,
  AnyActorRef,
  Compute,
  DoneActorEvent,
  DoNotInfer,
  EventDescriptor,
  EventObject,
  ExtractEvent,
  InitialContext,
  IsNever,
  MetaObject,
  NonReducibleUnknown,
  SingleOrArray,
  SnapshotEvent,
  StateValue,
  TODO,
  TransitionConfigFunction,
  Values,
  AnyStateNode
} from './types';
import { MachineContext, Mapper } from './types';
import { LowInfer } from './types';
import { DoneStateEvent } from './types';

export type InferOutput<T extends StandardSchemaV1, U> = Compute<
  StandardSchemaV1.InferOutput<T> extends U
    ? StandardSchemaV1.InferOutput<T>
    : never
>;

/**
 * Event payloads from schemas (e.g. Zod) are often inferred as optional in
 * output types. Wrapping in Required<> ensures properties defined in the schema
 * are required on the event.
 */
export type InferEvents<
  TEventSchemaMap extends Record<string, StandardSchemaV1>
> = Values<{
  [K in keyof TEventSchemaMap & string]: StandardSchemaV1.InferOutput<
    TEventSchemaMap[K]
  > extends infer O
    ? unknown extends O
      ? O & { type: K }
      : Required<O> & { type: K }
    : never;
}>;

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

type InternalEventDescriptorFor<TEvent extends EventObject> = [TEvent] extends [
  never
]
  ? string
  : EventDescriptor<TEvent>;

/**
 * A trigger declares how a machine is activated by external infrastructure.
 *
 * Triggers are metadata for platforms and tooling — they do not affect runtime
 * execution. The machine behaves identically whether input arrived from a
 * webhook, a cron job, an event source, or `actor.start({ input })` in a test.
 *
 * The `type` field is an open string so platforms can declare their own trigger
 * kinds (e.g. 'webhook', 'cron', 'event', 'manual', 'queue'). Additional
 * properties are platform-defined.
 *
 * @example
 *
 * ```ts
 * createMachine({
 *   triggers: [
 *     { type: 'webhook', path: '/api/orders' },
 *     { type: 'cron', schedule: '0 9 * * *' }
 *   ]
 *   // ...
 * });
 * ```
 */
export interface Trigger {
  type: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Runtime options for state machine execution.
 *
 * @example
 *
 * ```ts
 * const machine = createMachine({
 *   // ... machine config
 *   options: {
 *     maxIterations: 5000
 *     // other runtime options can be added here
 *   }
 * });
 * ```
 */
export interface MachineOptions {
  /**
   * Maximum number of microsteps allowed before throwing an infinite loop
   * error. Defaults to `Infinity` (no limit). Set to a finite number to enable
   * infinite loop detection.
   *
   * @default Infinity
   */
  maxIterations?: number;
}

export type Next_MachineConfig<
  TContextSchema extends StandardSchemaV1,
  TEventSchemaMap extends Record<string, StandardSchemaV1>,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>,
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  TContext extends MachineContext = InferOutput<TContextSchema, MachineContext>,
  TEvent extends EventObject = InferEvents<TEventSchemaMap>,
  TDelays extends string = string,
  _TTag extends string = string,
  TActionMap extends Implementations['actions'] = Implementations['actions'],
  TActorMap extends Implementations['actors'] = Implementations['actors'],
  TGuardMap extends Implementations['guards'] = Implementations['guards'],
  TDelayMap extends Implementations['delays'] = Implementations['delays'],
  TContextRequired extends boolean = IsNever<TContext> extends true
    ? false
    : true
> = (DistributiveOmit<
  Next_StateNodeConfig<
    TContext,
    DoNotInfer<InferEvents<TEventSchemaMap>>,
    DoNotInfer<TDelays>,
    DoNotInfer<StandardSchemaV1.InferOutput<TTagSchema> & string>,
    DoNotInfer<StandardSchemaV1.InferOutput<TOutputSchema>>,
    DoNotInfer<InferEvents<TEmittedSchemaMap>>,
    DoNotInfer<InferOutput<TMetaSchema, MetaObject>>,
    DoNotInfer<TActionMap>,
    DoNotInfer<TActorMap>,
    DoNotInfer<TGuardMap>,
    DoNotInfer<TDelayMap>
  >,
  'output'
> & {
  internalEvents?: readonly InternalEventDescriptorFor<
    InferEvents<TEventSchemaMap>
  >[];
  /**
   * Declares how this machine is activated by external infrastructure
   * (webhooks, cron schedules, event sources, etc.). Triggers are metadata for
   * platforms and tooling — they do not affect runtime execution.
   *
   * Plural because workflow tools commonly allow multiple triggers mapping to
   * the same input schema.
   */
  triggers?: readonly Trigger[];
  schemas?: {
    events?: TEventSchemaMap;
    context?: TContextSchema;
    emitted?: TEmittedSchemaMap;
    input?: TInputSchema;
    output?: TOutputSchema;
    meta?: TMetaSchema;
    tags?: TTagSchema;
  };
  actions?: TActionMap;
  guards?: TGuardMap;
  actors?: TActorMap;
  /** The initial context (extended state) */
  /** The machine's own version. */
  version?: string;
  // TODO: make it conditionally required
  output?:
    | Mapper<
        TContext,
        DoneStateEvent,
        InferOutput<TOutputSchema, unknown>,
        TEvent
      >
    | InferOutput<TOutputSchema, unknown>;
  delays?: {
    [K in TDelays | number]?:
      | number
      | (({
          context,
          event,
          stateNode
        }: {
          context: TContext;
          event: TEvent;
          stateNode: AnyStateNode;
        }) => number);
  };
  options?: MachineOptions;
}) &
  (TContextRequired extends false
    ? {
        context?: InitialContext<
          LowInfer<TContext>,
          TActorMap,
          InferOutput<TInputSchema, unknown>,
          TEvent
        >;
      }
    : {
        context: InitialContext<
          LowInfer<TContext>,
          TActorMap,
          InferOutput<TInputSchema, unknown>,
          TEvent
        >;
      });

export type DelayMap<TContext> = Record<
  string,
  number | ((context: TContext) => number)
>;

type ActorSrcKey<TActorMap extends Implementations['actors']> =
  string extends keyof TActorMap ? string : keyof TActorMap & string;

export interface Next_InvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject
> {
  src:
    | ActorSrcKey<TActorMap>
    | AnyActorLogic
    | (({
        actors,
        context,
        event,
        self
      }: {
        actors: TActorMap;
        context: TContext;
        event: TEvent;
        self: AnyActorRef;
      }) => ActorSrcKey<TActorMap> | AnyActorLogic);
  id?: string;
  systemId?: string;
  input?: (_: {
    context: TContext;
    event: TEvent;
    self: ActorRef<
      MachineSnapshot<
        TContext,
        TEvent,
        Record<string, AnyActorRef | undefined>,
        StateValue,
        string,
        unknown,
        TODO,
        TODO
      >,
      TEvent,
      TEmitted
    >;
  }) => unknown;
  onDone?: Next_TransitionConfigOrTarget<
    TContext,
    DoneActorEvent,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta
  >;
  onError?: Next_TransitionConfigOrTarget<
    TContext,
    ErrorEvent,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta
  >;
  onSnapshot?: Next_TransitionConfigOrTarget<
    TContext,
    SnapshotEvent<any>,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta
  >;
  /**
   * The duration (in ms) after which this invocation will time out if it has
   * not completed. "This task is taking too long."
   *
   * When the timeout expires, the `onTimeout` transition is taken. If the
   * invoke completes first, the timeout is cancelled.
   */
  timeout?: number | ((args: { context: TContext; event: TEvent }) => number);
  /**
   * Transition taken when the invoke-level `timeout` expires. Required when
   * `timeout` is set on an invoke.
   */
  onTimeout?: Next_TransitionConfigOrTarget<
    TContext,
    TEvent,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta
  >;
}

/** Lookup state input type from an input map, with fallback to undefined */
export type LookupInput<
  TInputMap extends Record<string, unknown>,
  K extends string
> = K extends keyof TInputMap ? TInputMap[K] : undefined;

export type StateAction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmittedEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TInput = Record<string, unknown> | undefined
> = (
  _: Omit<
    Parameters<
      Action<
        TContext,
        TEvent,
        TEmittedEvent,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        never
      >
    >[0],
    'params'
  > & { input: TInput },
  enqueue: Parameters<
    Action<
      TContext,
      TEvent,
      TEmittedEvent,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      never
    >
  >[1]
) => ReturnType<
  Action<
    TContext,
    TEvent,
    TEmittedEvent,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    never
  >
>;

export type Next_ChoiceTarget<TMeta extends MetaObject> = {
  target: string | string[];
  description?: string;
  reenter?: boolean;
  meta?: TMeta;
  input?:
    | Record<string, unknown>
    | ((args: { context: any; event: any }) => Record<string, unknown>);
};

type Next_ChoiceArgs<
  TContext extends MachineContext,
  TCurrentEvent extends EventObject,
  TEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  _TCtx = [TContext] extends [never] ? any : TContext
> = Parameters<
  TransitionConfigFunction<
    TContext,
    TCurrentEvent,
    TEvent,
    EventObject,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    MetaObject,
    _TCtx
  >
>[0];

export type Next_ChoiceGuardObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> = {
  type: string;
  params?:
    | NonReducibleUnknown
    | ((args: { context: TContext; event: TEvent }) => NonReducibleUnknown);
};

export type Next_ChoiceGuardFunction<
  TContext extends MachineContext,
  TCurrentEvent extends EventObject,
  TEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = (
  args: Next_ChoiceArgs<
    TContext,
    TCurrentEvent,
    TEvent,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  >,
  params: NonReducibleUnknown
) => boolean;

export type Next_ChoiceConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> = Next_ChoiceTarget<TMeta> & {
  guard?:
    | Next_ChoiceGuardObject<TContext, TEvent>
    | Next_ChoiceGuardFunction<
        TContext,
        TEvent,
        TEvent,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap
      >;
};

export type Next_ChoiceConfigFunction<
  TContext extends MachineContext,
  TCurrentEvent extends EventObject,
  TEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject,
  _TCtx = [TContext] extends [never] ? any : TContext
> = (
  args: Next_ChoiceArgs<
    TContext,
    TCurrentEvent,
    TEvent,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    _TCtx
  >
) => Next_ChoiceTarget<TMeta>;

export type Next_StateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TDelays extends string,
  TTag extends string,
  _TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TInput = Record<string, unknown> | undefined,
  TInputMap extends Record<string, unknown> = Record<string, unknown>
> =
  | Next_RegularStateNodeConfig<
      TContext,
      TEvent,
      TDelays,
      TTag,
      _TOutput,
      TEmitted,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TInput,
      TInputMap
    >
  | Next_ChoiceStateNodeConfig<
      TContext,
      TEvent,
      TTag,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap
    >;

export interface Next_ChoiceStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTag extends string,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> {
  contextSchema?: StandardSchemaV1;
  type: 'choice';
  choices:
    | readonly Next_ChoiceConfig<
        TContext,
        TEvent,
        TMeta,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap
      >[]
    | Next_ChoiceConfigFunction<
        TContext,
        TEvent,
        TEvent,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TMeta
      >;
  id?: string | undefined;
  order?: number;
  tags?: TTag[];
  description?: string;
  meta?: TMeta;
  route?:
    | {
        description?: string;
        reenter?: boolean;
        meta?: TMeta;
        guard?: unknown;
        input?:
          | Record<string, unknown>
          | ((args: { context: any; event: any }) => Record<string, unknown>);
      }
    | undefined;
  initial?: never;
  history?: never;
  states?: never;
  invoke?: never;
  on?: never;
  entry?: never;
  exit?: never;
  onDone?: never;
  after?: never;
  timeout?: never;
  onTimeout?: never;
  always?: never;
  output?: never;
  target?: never;
}

export interface Next_RegularStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TDelays extends string,
  TTag extends string,
  _TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TInput = Record<string, unknown> | undefined,
  TInputMap extends Record<string, unknown> = Record<string, unknown>
> {
  contextSchema?: StandardSchemaV1;
  /** The initial state transition. */
  initial?:
    | string
    | {
        target: string;
        input?:
          | Record<string, unknown>
          | ((args: {
              context: TContext;
              event: TEvent;
            }) => Record<string, unknown>);
      }
    | undefined;
  /**
   * The type of this state node:
   *
   * - `'atomic'` - no child state nodes
   * - `'compound'` - nested child state nodes (XOR)
   * - `'parallel'` - orthogonal nested child state nodes (AND)
   * - `'history'` - history state node
   * - `'final'` - final state node
   */
  type?: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  /**
   * Indicates whether the state node is a history state node, and what type of
   * history: shallow, deep, true (shallow), false (none), undefined (none)
   */
  history?: 'shallow' | 'deep' | boolean | undefined;
  /**
   * The mapping of state node keys to their state node configurations
   * (recursive).
   */
  states?: {
    [K in string]: Next_StateNodeConfig<
      TContext,
      TEvent,
      TDelays,
      TTag,
      any, // TOutput,
      TEmitted,
      TMeta,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      LookupInput<TInputMap, K>,
      TInputMap
    >;
  };
  /**
   * The services to invoke upon entering this state node. These services will
   * be stopped upon exiting this state node.
   */
  invoke?: SingleOrArray<
    Next_InvokeConfig<
      TContext,
      TEvent,
      TEmitted,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TMeta
    >
  >;
  /** The mapping of event types to their potential transition(s). */
  on?: {
    [K in EventDescriptor<TEvent>]?: Next_TransitionConfigOrTarget<
      TContext,
      ExtractEvent<TEvent, K>,
      TEvent,
      TEmitted,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TMeta
    >;
  };
  /**
   * Enables routing to this state via `{ type: 'xstate.route', to: '#id' }`.
   * Requires this state node to have an explicit `id`.
   */
  route?:
    | {
        description?: string;
        reenter?: boolean;
        meta?: TMeta;
        guard?: unknown;
        input?:
          | Record<string, unknown>
          | ((args: { context: any; event: any }) => Record<string, unknown>);
      }
    | undefined;
  entry?: StateAction<
    TContext,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TInput
  >;
  exit?: StateAction<
    TContext,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TInput
  >;
  /**
   * The potential transition(s) to be taken upon reaching a final child state
   * node.
   *
   * This is equivalent to defining a `[done(id)]` transition on this state
   * node's `on` property.
   */
  onDone?:
    | string
    | TransitionConfigFunction<
        TContext,
        DoneStateEvent,
        TEvent,
        TEmitted,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TMeta
      >
    | undefined;
  /**
   * The mapping (or array) of delays (in milliseconds) to their potential
   * transition(s). The delayed transitions are taken after the specified delay
   * in an interpreter.
   */
  after?: {
    [K in DoNotInfer<TDelays> | number]?:
      | string
      | { target: string }
      | TransitionConfigFunction<
          TContext,
          TEvent,
          TEvent,
          TODO, // TEmitted
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap,
          TMeta
        >;
  };

  /**
   * The duration (in ms) after which this state will transition via `onTimeout`
   * if still active. "We've been in this state too long."
   *
   * Independent of `after` - both can coexist on the same state. Both cancel on
   * state exit.
   *
   * Can be a static number, a delay reference string, or a dynamic function.
   */
  timeout?:
    | number
    | DoNotInfer<TDelays>
    | ((args: {
        context: TContext;
        event: TEvent;
        stateNode: AnyStateNode;
      }) => number);
  /** Transition taken when `timeout` expires. Required when `timeout` is set. */
  onTimeout?: Next_TransitionConfigOrTarget<
    TContext,
    TEvent,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta
  >;

  /**
   * An eventless transition that is always taken when this state node is
   * active.
   */
  always?: Next_TransitionConfigOrTarget<
    TContext,
    TEvent,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta
  >;
  choices?: never;
  /**
   * The meta data associated with this state node, which will be returned in
   * State instances.
   */
  meta?: TMeta;
  /**
   * The output data sent with the "xstate.done.state._id_" event if this is a
   * final state node.
   *
   * The output data will be evaluated with the current `context` and placed on
   * the `.data` property of the event.
   */
  output?: Mapper<TContext, TEvent, unknown, TEvent> | NonReducibleUnknown;
  /**
   * The unique ID of the state node, which can be referenced as a transition
   * target via the `#id` syntax.
   */
  id?: string | undefined;
  /**
   * The order this state node appears. Corresponds to the implicit document
   * order.
   */
  order?: number;

  /**
   * The tags for this state node, which are accumulated into the `state.tags`
   * property.
   */
  tags?: TTag[];
  /** A text description of the state node */
  description?: string;

  /** A default target for a history state */
  target?: string | undefined; // `| undefined` makes `HistoryStateNodeConfig` compatible with this interface (it extends it) under `exactOptionalPropertyTypes`
}

export type Next_InitialTransitionConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject
> = TransitionConfigFunction<
  TContext,
  TEvent,
  TEvent,
  TEmitted,
  TActionMap,
  TActorMap,
  TGuardMap,
  TDelayMap,
  TMeta
>;

export type Next_TransitionConfigOrTarget<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject
> =
  | string
  | undefined
  | {
      target?: string | string[];
      description?: string;
      reenter?: boolean;
      meta?: TMeta;
      input?:
        | Record<string, unknown>
        | ((args: { context: any; event: any }) => Record<string, unknown>);
    }
  | {
      to?: TransitionConfigFunction<
        TContext,
        TExpressionEvent,
        TEvent,
        TEmitted,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TMeta
      >;
      description?: string;
      reenter?: boolean;
      meta?: TMeta;
      input?:
        | Record<string, unknown>
        | ((args: { context: any; event: any }) => Record<string, unknown>);
    }
  | TransitionConfigFunction<
      TContext,
      TExpressionEvent,
      TEvent,
      TEmitted,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TMeta
    >;

export interface Next_MachineTypes<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TDelay extends string,
  TTag extends string,
  TInput,
  TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject
> {
  context?: TContext;
  events?: TEvent;
  children?: any; // TODO
  tags?: TTag;
  input?: TInput;
  output?: TOutput;
  emitted?: TEmitted;
  delays?: TDelay;
  meta?: TMeta;
}

export interface Next_SetupTypes<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTag extends string,
  TInput,
  TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject
> {
  context?: TContext;
  events?: TEvent;
  tags?: TTag;
  input?: TInput;
  output?: TOutput;
  emitted?: TEmitted;
  meta?: TMeta;
}

export type WithDefault<T, Default> = IsNever<T> extends true ? Default : T;

export interface Implementations {
  actions: Record<string, (...args: any[]) => void>;
  guards: Record<string, (...args: any[]) => boolean>;
  delays: Record<string, number | ((...args: any[]) => number)>;
  actors: Record<string, AnyActorLogic>;
}
