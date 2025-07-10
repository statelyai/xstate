import { StandardSchemaV1 } from '../../xstate-store/src/schema';
import {
  Action2,
  DoNotInfer,
  EventDescriptor,
  EventObject,
  ExtractEvent,
  InitialContext,
  MetaObject,
  NonReducibleUnknown,
  TODO,
  TransitionConfigFunction
} from './types';
import { MachineContext, Mapper } from './types';
import { LowInfer } from './types';
import { DoneStateEvent } from './types';

export type Next_MachineConfig<
  _TContextSchema extends StandardSchemaV1,
  TEventSchema extends StandardSchemaV1,
  TContext extends MachineContext,
  TEvent extends EventObject = StandardSchemaV1.InferOutput<TEventSchema> &
    EventObject,
  TDelay extends string = string,
  TTag extends string = string,
  TInput = any,
  TOutput = unknown,
  TEmitted extends EventObject = EventObject,
  TMeta extends MetaObject = MetaObject
> = (Omit<
  Next_StateNodeConfig<
    TContext,
    DoNotInfer<StandardSchemaV1.InferOutput<TEventSchema> & EventObject>,
    DoNotInfer<TDelay>,
    DoNotInfer<TTag>,
    DoNotInfer<TOutput>,
    DoNotInfer<TEmitted>,
    DoNotInfer<TMeta>
  >,
  'output'
> & {
  schemas?: {
    event?: TEventSchema;
    context?: TContext;
  };
  /** The initial context (extended state) */
  /** The machine's own version. */
  version?: string;
  // TODO: make it conditionally required
  output?: Mapper<TContext, DoneStateEvent, TOutput, TEvent> | TOutput;
}) &
  (MachineContext extends TContext
    ? { context?: InitialContext<LowInfer<TContext>, TODO, TInput, TEvent> }
    : { context: InitialContext<LowInfer<TContext>, TODO, TInput, TEvent> });

export interface Next_StateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TDelay extends string,
  TTag extends string,
  _TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject
> {
  /** The initial state transition. */
  initial?:
    | Next_InitialTransitionConfig<TContext, TEvent, TEmitted>
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
      TDelay,
      TTag,
      any, // TOutput,
      TEmitted,
      TMeta
    >;
  };
  /**
   * The services to invoke upon entering this state node. These services will
   * be stopped upon exiting this state node.
   */
  invoke?: TODO;
  /** The mapping of event types to their potential transition(s). */
  on?: {
    [K in EventDescriptor<TEvent>]?: Next_TransitionConfigOrTarget<
      TContext,
      ExtractEvent<TEvent, K>,
      TEvent,
      TEmitted
    >;
  };
  entry?: Action2<TContext, TEvent, TEmitted>;
  exit?: Action2<TContext, TEvent, TEmitted>;
  /**
   * The potential transition(s) to be taken upon reaching a final child state
   * node.
   *
   * This is equivalent to defining a `[done(id)]` transition on this state
   * node's `on` property.
   */
  onDone?:
    | string
    | TransitionConfigFunction<TContext, DoneStateEvent, TEvent, TEmitted>
    | undefined;
  /**
   * The mapping (or array) of delays (in milliseconds) to their potential
   * transition(s). The delayed transitions are taken after the specified delay
   * in an interpreter.
   */
  after?: {
    [K in TDelay | number]?:
      | string
      | { target: string }
      | TransitionConfigFunction<
          TContext,
          TEvent,
          TEvent,
          TODO // TEmitted
        >;
  };

  /**
   * An eventless transition that is always taken when this state node is
   * active.
   */
  always?: Next_TransitionConfigOrTarget<TContext, TEvent, TEvent, TEmitted>;
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
  TEmitted extends EventObject
> = TransitionConfigFunction<TContext, TEvent, TEvent, TEmitted>;

export type Next_TransitionConfigOrTarget<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject
> =
  | string
  | undefined
  | { target?: string | string[]; description?: string; reenter?: boolean }
  | TransitionConfigFunction<TContext, TExpressionEvent, TEvent, TEmitted>;

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
