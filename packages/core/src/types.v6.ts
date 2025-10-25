import { StandardSchemaV1 } from '../../xstate-store/src/schema';
import {
  Action2,
  AnyActorLogic,
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
  TODO,
  TransitionConfigFunction
} from './types';
import { MachineContext, Mapper } from './types';
import { LowInfer } from './types';
import { DoneStateEvent } from './types';

export type InferOutput<T extends StandardSchemaV1, U> = Compute<
  StandardSchemaV1.InferOutput<T> extends U
    ? StandardSchemaV1.InferOutput<T>
    : never
>;

export type Next_MachineConfig<
  TContextSchema extends StandardSchemaV1,
  TEventSchema extends StandardSchemaV1,
  TEmittedSchema extends StandardSchemaV1,
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  TContext extends MachineContext = InferOutput<TContextSchema, MachineContext>,
  TEvent extends EventObject = StandardSchemaV1.InferOutput<TEventSchema> &
    EventObject,
  TDelays extends string = string,
  _TTag extends string = string,
  TActionMap extends Implementations['actions'] = Implementations['actions'],
  TActorMap extends Implementations['actors'] = Implementations['actors'],
  TGuardMap extends Implementations['guards'] = Implementations['guards'],
  TDelayMap extends Implementations['delays'] = Implementations['delays']
> = (Omit<
  Next_StateNodeConfig<
    InferOutput<TContextSchema, MachineContext>,
    DoNotInfer<StandardSchemaV1.InferOutput<TEventSchema> & EventObject>,
    DoNotInfer<TDelays>,
    DoNotInfer<StandardSchemaV1.InferOutput<TTagSchema> & string>,
    DoNotInfer<StandardSchemaV1.InferOutput<TOutputSchema>>,
    DoNotInfer<StandardSchemaV1.InferOutput<TEmittedSchema> & EventObject>,
    DoNotInfer<InferOutput<TMetaSchema, MetaObject>>,
    DoNotInfer<TActionMap>,
    DoNotInfer<TActorMap>,
    DoNotInfer<TGuardMap>,
    DoNotInfer<TDelayMap>
  >,
  'output'
> & {
  schemas?: {
    events?: TEventSchema;
    context?: TContextSchema;
    emitted?: TEmittedSchema;
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
      | (({ context, event }: { context: TContext; event: TEvent }) => number);
  };
}) &
  (IsNever<TContext> extends true
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
  src: AnyActorLogic | (({ actors }: { actors: TActorMap }) => AnyActorLogic);
  id?: string;
  systemId?: string;
  input?: TODO;
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
}

export interface Next_StateNodeConfig<
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
  TDelayMap extends Implementations['delays']
> {
  /** The initial state transition. */
  initial?:
    | Next_InitialTransitionConfig<
        TContext,
        TEvent,
        TEmitted,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TMeta
      >
    | string
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
      TDelayMap
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
  entry?: Action2<
    TContext,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  >;
  exit?: Action2<
    TContext,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
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
  | { target?: string | string[]; description?: string; reenter?: boolean }
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
