import { StandardSchemaV1 } from './schema.types.ts';
import { MachineSnapshot } from './State';
import {
  Action,
  ActorLogic,
  ActorRef,
  ActorRefFromLogic,
  ActorSelf,
  AnyActorLogic,
  AnyActorRef,
  Compute,
  DoneActorEvent,
  DoNotInfer,
  ErrorActorEvent,
  EventDescriptor,
  ErrorEvent,
  EventObject,
  ExtractEvent,
  InitialContext,
  InputFrom,
  IsNever,
  MetaObject,
  NonReducibleUnknown,
  OutputFrom,
  SingleOrArray,
  SnapshotEvent,
  StateValue,
  TODO,
  TransitionContextMapper,
  TransitionContextPatch,
  TransitionConfigFunction,
  Values,
  AnyStateNode,
  SystemRegistry
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
    ? [O] extends [never]
      ? never
      : unknown extends O
        ? O & { type: K }
        : [O] extends [void]
          ? { type: K }
          : string extends keyof O
            ? [O[string]] extends [never]
              ? { type: K }
              : Required<O> & { type: K }
            : Required<O> & { type: K }
    : never;
}>;

export type InferChildren<
  TChildrenSchemaMap extends Record<string, StandardSchemaV1>
> = string extends keyof TChildrenSchemaMap
  ? {}
  : {
      [K in keyof TChildrenSchemaMap & string]?: StandardSchemaV1.InferOutput<
        TChildrenSchemaMap[K]
      > extends AnyActorRef
        ? NormalizeActorRef<StandardSchemaV1.InferOutput<TChildrenSchemaMap[K]>>
        : never;
    };

export type ActionSchemas = Record<string, { params: StandardSchemaV1 }>;

export type GuardSchemas = Record<string, { params: StandardSchemaV1 }>;

export type InferActions<TActionSchemaMap extends ActionSchemas> =
  string extends keyof TActionSchemaMap
    ? {}
    : {
        [K in keyof TActionSchemaMap & string]: (
          params: StandardSchemaV1.InferOutput<TActionSchemaMap[K]['params']>
        ) => void | { context?: any; children?: any };
      };

export type InferGuards<TGuardSchemaMap extends GuardSchemas> =
  string extends keyof TGuardSchemaMap
    ? {}
    : {
        [K in keyof TGuardSchemaMap & string]: (
          params: StandardSchemaV1.InferOutput<TGuardSchemaMap[K]['params']>
        ) => boolean;
      };

type OutputMapper<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TResult,
  TInput = Record<string, unknown> | undefined
> = (
  args: Parameters<Mapper<TContext, TEvent, TResult, TEvent>>[0] & {
    input: TInput;
  }
) => TResult;

type OutputConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TOutput,
  TInput = Record<string, unknown> | undefined
> = unknown extends TOutput
  ?
      | OutputMapper<TContext, TEvent, NonReducibleUnknown, TInput>
      | NonReducibleUnknown
  : OutputMapper<TContext, TEvent, TOutput, TInput> | TOutput;

export type ValidateTopLevelFinalOutputs<
  TConfig,
  TContext extends MachineContext,
  TEvent extends EventObject
> = TConfig extends {
  schemas: { output: infer TOutputSchema extends StandardSchemaV1 };
  states: infer TStates;
}
  ? {
      states?: {
        [K in keyof TStates]: TStates[K] extends { type: 'final' }
          ? TStates[K] & {
              output?: OutputConfig<
                TContext,
                TEvent,
                StandardSchemaV1.InferOutput<TOutputSchema>
              >;
            }
          : TStates[K];
      };
    }
  : {};

type NormalizeActorRef<TActorRef> =
  TActorRef extends ActorRef<
    infer TSnapshot,
    infer TEvent,
    infer TEmitted,
    infer TSendEvent
  >
    ? ActorRef<TSnapshot, TEvent, TEmitted, TSendEvent>
    : never;

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

type InternalEventDescriptorFor<TEvent extends EventObject> = [TEvent] extends [
  never
]
  ? string
  : EventDescriptor<TEvent>;

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

type MachineSchemas<
  TContextSchema extends StandardSchemaV1,
  TEventSchemaMap extends Record<string, StandardSchemaV1>,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>,
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  TChildrenSchemaMap extends Record<string, StandardSchemaV1>
> = {
  events?: TEventSchemaMap;
  actions?: ActionSchemas;
  guards?: GuardSchemas;
  context?: TContextSchema;
  emitted?: TEmittedSchemaMap;
  input?: TInputSchema;
  output?: TOutputSchema;
  meta?: TMetaSchema;
  tags?: TTagSchema;
  children?: TChildrenSchemaMap;
};

export type AnyMachineSchemas = MachineSchemas<
  StandardSchemaV1,
  Record<string, StandardSchemaV1>,
  Record<string, StandardSchemaV1>,
  StandardSchemaV1,
  StandardSchemaV1,
  StandardSchemaV1,
  StandardSchemaV1,
  Record<string, StandardSchemaV1>
>;

export type Next_MachineConfig<
  TContextSchema extends StandardSchemaV1,
  TEventSchemaMap extends Record<string, StandardSchemaV1>,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>,
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  TChildrenSchemaMap extends Record<string, StandardSchemaV1>,
  TContext extends MachineContext = InferOutput<TContextSchema, MachineContext>,
  TEvent extends EventObject = InferEvents<TEventSchemaMap>,
  TChildren extends Record<
    string,
    AnyActorRef | undefined
  > = InferChildren<TChildrenSchemaMap>,
  TDelays extends string = string,
  _TTag extends string = string,
  TActionMap extends Implementations['actions'] = Implementations['actions'],
  TActorMap extends
    Implementations['actorSources'] = Implementations['actorSources'],
  TGuardMap extends Implementations['guards'] = Implementations['guards'],
  TDelayMap extends Implementations['delays'] = Implementations['delays'],
  TContextRequired extends boolean = IsNever<TContext> extends true
    ? false
    : true,
  TSystemRegistry extends SystemRegistry = SystemRegistry
> = (DistributiveOmit<
  Next_StateNodeConfig<
    TContext,
    DoNotInfer<InferEvents<TEventSchemaMap>>,
    DoNotInfer<TDelays>,
    DoNotInfer<StandardSchemaV1.InferOutput<TTagSchema> & string>,
    DoNotInfer<StandardSchemaV1.InferOutput<TOutputSchema>>,
    DoNotInfer<InferEvents<TEmittedSchemaMap>>,
    DoNotInfer<InferOutput<TMetaSchema, MetaObject>>,
    DoNotInfer<TChildren>,
    DoNotInfer<TActionMap>,
    DoNotInfer<TActorMap>,
    DoNotInfer<TGuardMap>,
    DoNotInfer<TDelayMap>,
    Record<string, unknown> | undefined,
    Record<string, unknown>,
    DoNotInfer<TSystemRegistry>,
    DoNotInfer<InferOutput<TOutputSchema, unknown>>
  >,
  'output'
> & {
  internalEvents?: readonly InternalEventDescriptorFor<
    InferEvents<TEventSchemaMap>
  >[];
  schemas?: MachineSchemas<
    TContextSchema,
    TEventSchemaMap,
    TEmittedSchemaMap,
    TInputSchema,
    TOutputSchema,
    TMetaSchema,
    TTagSchema,
    TChildrenSchemaMap
  >;
  actions?: TActionMap;
  guards?: TGuardMap;
  actorSources?: TActorMap;
  /** The machine's own version. */
  version?: string;
  /**
   * Migrates a persisted snapshot created by a different version of this
   * machine to the current `version`. Called during restore when the persisted
   * snapshot's `version` does not match the machine's `version` (`fromVersion`
   * is the persisted version, possibly `undefined`). Restoring a
   * version-mismatched snapshot without a `migrate` function throws.
   */
  migrate?: (
    persistedSnapshot: any,
    fromVersion: string | undefined
  ) => unknown;
  // TODO: make it conditionally required
  output?:
    | Mapper<
        TContext,
        DoneStateEvent<DoNotInfer<InferOutput<TOutputSchema, unknown>>>,
        DoNotInfer<InferOutput<TOutputSchema, unknown>>,
        TEvent
      >
    | DoNotInfer<InferOutput<TOutputSchema, unknown>>;
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

/**
 * Recursively widens literal types and strips `readonly`. Used to widen context
 * inferred from a literal initial value (e.g. `{ count: 0 }` becomes `{ count:
 * number }`), since `createMachine`'s `const` state-schema inference would
 * otherwise freeze context at its initial literal type and make every context
 * update a type error.
 */
export type WidenLiterals<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends bigint
        ? bigint
        : T extends (...args: any[]) => any
          ? T
          : T extends readonly (infer U)[]
            ? WidenLiterals<U>[]
            : T extends object
              ? { -readonly [K in keyof T]: WidenLiterals<T[K]> }
              : T;

type InvokeSrcArgs<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActorMap extends Implementations['actorSources']
> = {
  actorSources: TActorMap;
  context: TContext;
  event: TEvent;
  self: AnyActorRef;
};

type InvokeInputArgs<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>
> = {
  context: TContext;
  event: TEvent;
  self: ActorSelf<
    MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      StateValue,
      string,
      unknown,
      TODO,
      TODO
    >,
    TEvent,
    TEmitted
  >;
};

type HasExplicitChildren<
  TChildren extends Record<string, AnyActorRef | undefined>
> = string extends keyof TChildren
  ? false
  : [keyof TChildren] extends [never]
    ? false
    : true;

type ChildIdForLogic<
  TLogic extends AnyActorLogic,
  TChildren extends Record<string, AnyActorRef | undefined>
> =
  HasExplicitChildren<TChildren> extends true
    ? Values<{
        [K in keyof TChildren &
          string]: ActorRefFromLogic<TLogic> extends NonNullable<TChildren[K]>
          ? K
          : never;
      }>
    : string;

type LogicForChildRef<TActorRef> =
  NonNullable<TActorRef> extends ActorRef<
    infer TSnapshot,
    infer TEvent,
    infer TEmitted,
    any
  >
    ? ActorLogic<TSnapshot, TEvent, any, any, TEmitted>
    : never;

type InlineChildInvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject,
  TSystemRegistry extends SystemRegistry
> = Values<{
  [K in keyof TChildren & string]: Next_InvokeConfigBase<
    TContext,
    TEvent,
    TEmitted,
    TChildren,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta,
    TSystemRegistry
  > & {
    id: K;
    src: LogicForChildRef<TChildren[K]>;
    input?:
      | ((
          args: InvokeInputArgs<TContext, TEvent, TEmitted, TChildren>
        ) => unknown)
      | NonReducibleUnknown;
  };
}>;

type InlineInvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject,
  TSystemRegistry extends SystemRegistry
> =
  HasExplicitChildren<TChildren> extends true
    ? InlineChildInvokeConfig<
        TContext,
        TEvent,
        TEmitted,
        TChildren,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TMeta,
        TSystemRegistry
      >
    : Next_InvokeConfigBase<
        TContext,
        TEvent,
        TEmitted,
        TChildren,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TMeta,
        TSystemRegistry
      > & {
        src: AnyActorLogic;
        input?:
          | ((
              args: InvokeInputArgs<TContext, TEvent, TEmitted, TChildren>
            ) => unknown)
          | NonReducibleUnknown;
      };

/**
 * Invoke config. A union of:
 *
 * - One branch per registered actor source (distributed over the `actorSources`
 *   map), where `src` — a key, the logic itself, or a resolver function
 *   returning either — is correlated with `input`, so static and mapped inputs
 *   typecheck against that logic's input type.
 * - A branch for inline (unregistered) actor logic values, whose `input` cannot
 *   be correlated (the config is not generic over inline logic).
 */
export type Next_InvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject,
  TSystemRegistry extends SystemRegistry = SystemRegistry
> = string extends keyof TActorMap
  ? // No registered actor sources (permissive map): `src`/`input` cannot be
    // correlated. A mapped type over `string` would also defer resolution and
    // break contextual typing, so this case is its own branch.
    HasExplicitChildren<TChildren> extends true
    ? InlineInvokeConfig<
        TContext,
        TEvent,
        TEmitted,
        TChildren,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TMeta,
        TSystemRegistry
      >
    : Next_InvokeConfigBase<
        TContext,
        TEvent,
        TEmitted,
        TChildren,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TMeta,
        TSystemRegistry
      > & {
        src:
          | string
          | AnyActorLogic
          | ((
              args: InvokeSrcArgs<TContext, TEvent, TActorMap>
            ) => string | AnyActorLogic);
        input?:
          | ((
              args: InvokeInputArgs<TContext, TEvent, TEmitted, TChildren>
            ) => unknown)
          | NonReducibleUnknown;
      }
  :
      | {
          [K in keyof TActorMap & string]: Next_InvokeConfigBase<
            TContext,
            TEvent,
            TEmitted,
            TChildren,
            TActionMap,
            TActorMap,
            TGuardMap,
            TDelayMap,
            TMeta,
            TSystemRegistry,
            DoneActorEvent<OutputFrom<TActorMap[K]>>
          > & {
            id?: ChildIdForLogic<TActorMap[K], TChildren>;
            input?:
              | ((
                  args: InvokeInputArgs<TContext, TEvent, TEmitted, TChildren>
                ) => InputFrom<TActorMap[K]>)
              | InputFrom<TActorMap[K]>;
          } & (
              | {
                  src: K;
                }
              | {
                  src: TActorMap[K];
                }
              | {
                  src: (
                    args: InvokeSrcArgs<TContext, TEvent, TActorMap>
                  ) => K | TActorMap[K];
                }
            );
        }[keyof TActorMap & string]
      | InlineInvokeConfig<
          TContext,
          TEvent,
          TEmitted,
          TChildren,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap,
          TMeta,
          TSystemRegistry
        >;

interface Next_InvokeConfigBase<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  _TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject,
  TSystemRegistry extends SystemRegistry,
  TDoneEvent extends EventObject = [keyof TActorMap & string] extends [never]
    ? DoneActorEvent<any>
    : DoneActorEvent<OutputFrom<TActorMap[keyof TActorMap & string]>>
> {
  id?: string;
  registryKey?: keyof TSystemRegistry & string;
  onDone?: Next_TransitionConfigOrTarget<
    TContext,
    TDoneEvent,
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
    ErrorActorEvent,
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
type LookupInput<
  TInputMap extends Record<string, unknown>,
  K extends string
> = K extends keyof TInputMap ? TInputMap[K] : undefined;

type StateAction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmittedEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
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

type Next_ChoiceTarget<TMeta extends MetaObject> = {
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
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  _TCtx extends MachineContext = [TContext] extends [never] ? any : TContext
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
    undefined, // TInput
    _TCtx
  >
>[0];

/**
 * Route config: either a static config object, or a transition-style function
 * that acts as the route's guard and resolver — returning `undefined`/`false`
 * blocks the route; returning `true` or a config object allows it (optionally
 * updating `context` and providing `input`/`reenter`/`meta`).
 *
 * Guard objects/strings on routes are only produced by the JSON layer
 * (`createMachineFromConfig`) — authoring uses the function form.
 */
type Next_RouteConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> =
  | {
      description?: string;
      reenter?: boolean;
      meta?: TMeta;
      input?:
        | Record<string, unknown>
        | ((args: { context: any; event: any }) => Record<string, unknown>);
    }
  | ((
      args: Next_ChoiceArgs<
        TContext,
        TEvent,
        TEvent,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap
      >
    ) =>
      | boolean
      | void
      | {
          context?: TContext;
          reenter?: boolean;
          meta?: TMeta;
          input?:
            | Record<string, unknown>
            | ((args: { context: any; event: any }) => Record<string, unknown>);
        });

type Next_ChoiceConfigFunction<
  TContext extends MachineContext,
  TCurrentEvent extends EventObject,
  TEvent extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject,
  _TCtx extends MachineContext = [TContext] extends [never] ? any : TContext
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
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TInput = Record<string, unknown> | undefined,
  TInputMap extends Record<string, unknown> = Record<string, unknown>,
  TSystemRegistry extends SystemRegistry = SystemRegistry,
  TChildOutput = unknown
> =
  | Next_RegularStateNodeConfig<
      TContext,
      TEvent,
      TDelays,
      TTag,
      _TOutput,
      TEmitted,
      TMeta,
      TChildren,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TInput,
      TInputMap,
      TSystemRegistry,
      TChildOutput
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

interface Next_ChoiceStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TTag extends string,
  TMeta extends MetaObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> {
  contextSchema?: StandardSchemaV1;
  type: 'choice';
  /** Function that resolves this choice state to a target. */
  choice: Next_ChoiceConfigFunction<
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
    | Next_RouteConfig<
        TContext,
        TEvent,
        TMeta,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap
      >
    | undefined;
  initial?: never;
  history?: never;
  states?: never;
  invoke?: never;
  on?: never;
  entry?: never;
  exit?: never;
  onDone?: never;
  onError?: never;
  after?: never;
  timeout?: never;
  onTimeout?: never;
  always?: never;
  output?: never;
  target?: never;
}

interface Next_RegularStateNodeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TDelays extends string,
  TTag extends string,
  TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TInput = Record<string, unknown> | undefined,
  TInputMap extends Record<string, unknown> = Record<string, unknown>,
  TSystemRegistry extends SystemRegistry = SystemRegistry,
  TChildOutput = unknown
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
      TChildren,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      LookupInput<TInputMap, K>,
      TInputMap,
      TSystemRegistry,
      TChildOutput
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
      TChildren,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TMeta,
      TSystemRegistry
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
      TMeta,
      TInput
    >;
  };
  /**
   * Enables routing to this state via `{ type: 'xstate.route', to: '#id' }`.
   * Requires this state node to have an explicit `id`.
   */
  route?:
    | Next_RouteConfig<
        TContext,
        TEvent,
        TMeta,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap
      >
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
  onDone?: Next_TransitionConfigOrTarget<
    TContext,
    DoneStateEvent,
    TEvent,
    TEmitted,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap,
    TMeta
  >;
  /**
   * The transition to take when an `xstate.error.*` event is raised while this
   * state node or one of its descendants is active.
   */
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
  /**
   * The mapping (or array) of delays (in milliseconds) to their potential
   * transition(s). The delayed transitions are taken after the specified delay
   * in an interpreter.
   */
  after?: {
    [K in NoInfer<TDelays> | number]?:
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
          TMeta,
          TInput
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
    | NoInfer<TDelays>
    | ((args: {
        context: TContext;
        event: TEvent;
        stateNode: AnyStateNode;
        input: TInput;
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
    TMeta,
    TInput
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
  choice?: never;
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
  output?: OutputConfig<TContext, TEvent, TOutput, TInput>;
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

export type Next_TransitionConfigOrTarget<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TMeta extends MetaObject,
  TInput = undefined
> =
  | undefined
  | {
      target?: string | string[];
      context?:
        | TransitionContextPatch<TContext>
        | TransitionContextMapper<
            TContext,
            TExpressionEvent,
            TEvent,
            TActionMap,
            TActorMap,
            TGuardMap,
            TDelayMap
          >;
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
        TMeta,
        TInput
      >;
      context?:
        | TransitionContextPatch<TContext>
        | TransitionContextMapper<
            TContext,
            TExpressionEvent,
            TEvent,
            TActionMap,
            TActorMap,
            TGuardMap,
            TDelayMap
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
      TMeta,
      TInput
    >;

export type WithDefault<T, Default> = IsNever<T> extends true ? Default : T;

export interface Implementations {
  actions: Record<
    string,
    (...args: any[]) => void | { context?: any; children?: any }
  >;
  guards: Record<string, (...args: any[]) => boolean>;
  delays: Record<string, number | ((...args: any[]) => number)>;
  actorSources: Record<string, AnyActorLogic>;
}

export type DelayMapFromNames<
  TDelays extends string,
  _TDelayMap extends Implementations['delays']
> = string extends TDelays
  ? Implementations['delays']
  : { [K in TDelays]: Implementations['delays'][string] };

type DelayNamesFromConfig<TConfig> = TConfig extends {
  delays: infer TDelays;
}
  ? Extract<keyof TDelays, string>
  : string;

// Checks only `after` keys (and nested `states`): a bad `after` key is accepted
// structurally, so it needs validation here. A bad `timeout` string is already
// rejected by the `timeout?:` field type, so it needs no branch.
type InvalidDelayReferences<TConfig, TDelays extends string> =
  | (TConfig extends { after: infer TAfter }
      ? Exclude<Extract<keyof TAfter, string>, TDelays>
      : never)
  | (TConfig extends { states: infer TStates }
      ? TStates extends Record<string, unknown>
        ? {
            [K in keyof TStates]: InvalidDelayReferences<TStates[K], TDelays>;
          }[keyof TStates]
        : never
      : never);

export type ValidateDelayReferences<TConfig> =
  string extends DelayNamesFromConfig<TConfig>
    ? unknown
    : InvalidDelayReferences<
          TConfig,
          DelayNamesFromConfig<TConfig>
        > extends never
      ? unknown
      : never;
