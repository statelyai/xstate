import {
  SetupStateSchemas,
  StandardSchemaV1,
  TypeSchema
} from './schema.types.ts';
import { MachineSnapshot } from './State';
import {
  Action,
  ActorTimeoutEvent,
  AfterEvent,
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
  EventPayloadPattern,
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
  SystemRegistry,
  TimeoutEvent
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
 * are required on the event. Type-only schemas created with the `types()`
 * helper are exempt: their declared type is authoritative, so optional
 * properties stay optional.
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
              ? { type: EventTypeFromSchemaKey<K> }
              : NormalizeEventPayload<TEventSchemaMap[K], O> & {
                  type: EventTypeFromSchemaKey<K>;
                }
            : NormalizeEventPayload<TEventSchemaMap[K], O> & {
                type: EventTypeFromSchemaKey<K>;
              }
    : never;
}>;

/** Infers internal events only from explicitly declared schema keys. */
export type InferInternalEvents<
  TEventSchemaMap extends Record<string, StandardSchemaV1>
> = string extends keyof TEventSchemaMap ? never : InferEvents<TEventSchemaMap>;

type EventTypeFromSchemaKey<TKey extends string> = TKey extends '*'
  ? string
  : TKey extends `${infer TLeading}.*`
    ? `${TLeading}.${string}`
    : TKey;

/**
 * Keeps a type-only schema's payload verbatim; applies Required<> to payloads
 * from validator libraries (see {@link InferEvents}).
 */
type NormalizeEventPayload<TSchema extends StandardSchemaV1, O> =
  TSchema extends TypeSchema<any> ? O : Required<O>;

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
  TInternalEventSchemaMap extends Record<string, StandardSchemaV1>,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>,
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  TChildrenSchemaMap extends Record<string, StandardSchemaV1>
> = {
  events?: TEventSchemaMap;
  internalEvents?: TInternalEventSchemaMap;
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
  TInternalEventSchemaMap extends Record<string, StandardSchemaV1>,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>,
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  TChildrenSchemaMap extends Record<string, StandardSchemaV1>,
  TContext extends MachineContext = InferOutput<TContextSchema, MachineContext>,
  TEvent extends EventObject =
    | InferEvents<TEventSchemaMap>
    | InferInternalEvents<TInternalEventSchemaMap>,
  TChildren extends Record<string, AnyActorRef | undefined> =
    InferChildren<TChildrenSchemaMap>,
  TDelays extends string = string,
  _TTag extends string = string,
  TActionMap extends Sources['actions'] = Sources['actions'],
  TActorMap extends Sources['actors'] = Sources['actors'],
  TGuardMap extends Sources['guards'] = Sources['guards'],
  TDelayMap extends Sources['delays'] = Sources['delays'],
  TContextRequired extends boolean = IsNever<TContext> extends true
    ? false
    : true,
  TSystemRegistry extends SystemRegistry = SystemRegistry
> = (DistributiveOmit<
  Next_StateNodeConfig<
    TContext,
    DoNotInfer<TEvent>,
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
  'output' | 'schemas'
> & {
  /** @deprecated Declare private event schemas in `schemas.internalEvents`. */
  internalEvents?: readonly InternalEventDescriptorFor<TEvent>[];
  schemas?: MachineSchemas<
    TContextSchema,
    TEventSchemaMap,
    TInternalEventSchemaMap,
    TEmittedSchemaMap,
    TInputSchema,
    TOutputSchema,
    TMetaSchema,
    TTagSchema,
    TChildrenSchemaMap
  >;
  actions?: TActionMap;
  guards?: TGuardMap;
  actors?: TActorMap;
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
  TActorMap extends Sources['actors']
> = {
  actors: TActorMap;
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

/**
 * The `onDone` config for inline (unregistered-logic) invoke branches.
 *
 * When the actor map has registered sources, this deliberately has no
 * function forms (no transition function, no context mapper): passing a
 * registered logic value as `src` makes TypeScript narrow the invoke union to
 * the matching registered branch plus the inline branch, and per-actor
 * `event.output` inference in `onDone` callbacks only survives if the
 * registered branch contributes the union's only call signature. Inline
 * (unregistered) logic in such setups can use the object/target forms, or be
 * registered to get function-form transitions.
 *
 * With no registered sources (empty or permissive maps) there is no competing
 * branch, so the full transition config is allowed.
 */
type InlineInvokeOnDone<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TMeta extends MetaObject
> = [keyof TActorMap & string] extends [never]
  ? Next_TransitionConfigOrTarget<
      TContext,
      DoneActorEvent<any>,
      TEvent,
      TEmitted,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TMeta
    >
  : string extends keyof TActorMap
    ? Next_TransitionConfigOrTarget<
        TContext,
        DoneActorEvent<OutputFrom<TActorMap[keyof TActorMap & string]>>,
        TEvent,
        TEmitted,
        TActionMap,
        TActorMap,
        TGuardMap,
        TDelayMap,
        TMeta
      >
    :
        | undefined
        | {
            matches?: EventPayloadPattern<DoneActorEvent>;
            target?: string | string[];
            context?: TransitionContextPatch<TContext>;
            description?: string;
            reenter?: boolean;
            meta?: TMeta;
            input?:
              | Record<string, unknown>
              | ((args: {
                  context: any;
                  event: any;
                }) => Record<string, unknown>);
          };

type InlineChildInvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TMeta extends MetaObject,
  TSystemRegistry extends SystemRegistry
> = Values<{
  [K in keyof TChildren & string]: Omit<
    Next_InvokeConfigBase<
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
    >,
    'onDone'
  > & {
    onDone?: InlineInvokeOnDone<
      TContext,
      TEvent,
      TEmitted,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TMeta
    >;
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
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
    : Omit<
        Next_InvokeConfigBase<
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
        >,
        'onDone'
      > & {
        onDone?: InlineInvokeOnDone<
          TContext,
          TEvent,
          TEmitted,
          TActionMap,
          TActorMap,
          TGuardMap,
          TDelayMap,
          TMeta
        >;
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
 * - One branch per registered actor source (distributed over the `actors` map),
 *   where `src` — a key, the logic itself, or a resolver function returning
 *   either — is correlated with `input`, so static and mapped inputs typecheck
 *   against that logic's input type.
 * - A branch for inline (unregistered) actor logic values, whose `input` cannot
 *   be correlated (the config is not generic over inline logic).
 */
export type Next_InvokeConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
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
    ActorTimeoutEvent,
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays']
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays']
> {
  contextSchema?: StandardSchemaV1;
  schemas?: SetupStateSchemas;
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TInput = Record<string, unknown> | undefined,
  TInputMap extends Record<string, unknown> = Record<string, unknown>,
  TSystemRegistry extends SystemRegistry = SystemRegistry,
  TChildOutput = unknown
> {
  contextSchema?: StandardSchemaV1;
  schemas?: SetupStateSchemas;
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
    DoneStateEvent<TChildOutput>,
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
          AfterEvent,
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
    TimeoutEvent,
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
   * The output data sent with the `xstate.done.state` event if this is a final
   * state node.
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
  target?: string | string[] | undefined;
}

export type Next_TransitionConfigOrTarget<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TEmitted extends EventObject,
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays'],
  TMeta extends MetaObject,
  TInput = undefined
> =
  | undefined
  | {
      matches?: EventPayloadPattern<TExpressionEvent>;
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
      matches?: EventPayloadPattern<TExpressionEvent>;
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

export interface Sources {
  actions: Record<
    string,
    (...args: any[]) => void | { context?: any; children?: any }
  >;
  guards: Record<string, (...args: any[]) => boolean>;
  delays: Record<string, number | ((...args: any[]) => number)>;
  actors: Record<string, AnyActorLogic>;
}

export type DelayMapFromNames<
  TDelays extends string,
  _TDelayMap extends Sources['delays']
> = string extends TDelays
  ? Sources['delays']
  : { [K in TDelays]: Sources['delays'][string] };

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

type IsHistoryStateConfig<TConfig> = TConfig extends { type: 'history' }
  ? true
  : TConfig extends { history: false | undefined }
    ? false
    : TConfig extends { history: unknown }
      ? true
      : false;

type MissingHistoryDefault<TConfig> = 0 extends 1 & TConfig
  ? never
  : IsHistoryStateConfig<TConfig> extends true
    ? TConfig extends {
        target: string | readonly [string, ...string[]];
      }
      ? never
      : true
    : TConfig extends { states: infer TStates }
      ? TStates extends Record<string, unknown>
        ? {
            [K in keyof TStates]: MissingHistoryDefault<TStates[K]>;
          }[keyof TStates]
        : never
      : never;

/**
 * Rejects authored machines containing a history state without its SCXML
 * default target.
 */
export type ValidateHistoryDefaults<TConfig> =
  MissingHistoryDefault<TConfig> extends never ? unknown : never;

type StatePath = readonly string[];

type AppendStatePath<TPrefix extends StatePath, TKey extends string> = [
  ...TPrefix,
  TKey
];

type EscapeStatePathDots<TValue extends string> =
  TValue extends `${infer THead}.${infer TTail}`
    ? `${THead}\\.${EscapeStatePathDots<TTail>}`
    : TValue;

type ProtectEscapedStatePathDots<TValue extends string> =
  TValue extends `${infer THead}\\.${infer TTail}`
    ? `${THead}__XSTATE_ESCAPED_DOT__${ProtectEscapedStatePathDots<TTail>}`
    : TValue;

type RestoreEscapedStatePathDots<TValue extends string> =
  TValue extends `${infer THead}__XSTATE_ESCAPED_DOT__${infer TTail}`
    ? `${THead}.${RestoreEscapedStatePathDots<TTail>}`
    : TValue;

type SplitStatePath<TPath extends string> =
  ProtectEscapedStatePathDots<TPath> extends infer TProtected extends string
    ? TProtected extends ''
      ? []
      : TProtected extends `${infer THead}.${infer TTail}`
        ? [RestoreEscapedStatePathDots<THead>, ...SplitStatePath<TTail>]
        : [RestoreEscapedStatePathDots<TProtected>]
    : never;

type ParentStatePath<TPath extends StatePath> = TPath extends readonly [
  ...infer TParent extends string[],
  string
]
  ? TParent
  : [];

type StatePathsFromStates<TStates, TPrefix extends StatePath = []> =
  TStates extends Record<string, unknown>
    ? {
        [K in keyof TStates & string]:
          | AppendStatePath<TPrefix, K>
          | (0 extends 1 & TStates[K]
              ? never
              : TStates[K] extends { states: infer TChildren }
                ? StatePathsFromStates<TChildren, AppendStatePath<TPrefix, K>>
                : never);
      }[keyof TStates & string]
    : never;

type AuthoredStatePaths<TConfig> = TConfig extends { states: infer TStates }
  ? StatePathsFromStates<TStates>
  : never;

type OpaqueStatePathsFromStates<TStates, TPrefix extends StatePath = []> =
  TStates extends Record<string, unknown>
    ? {
        [K in keyof TStates & string]: 0 extends 1 & TStates[K]
          ? AppendStatePath<TPrefix, K>
          : TStates[K] extends { states: infer TChildren }
            ? OpaqueStatePathsFromStates<TChildren, AppendStatePath<TPrefix, K>>
            : never;
      }[keyof TStates & string]
    : never;

type OpaqueStatePaths<TConfig> = TConfig extends { states: infer TStates }
  ? OpaqueStatePathsFromStates<TStates>
  : never;

type IsWithinStatePath<
  TPath extends StatePath,
  TAncestor
> = TAncestor extends StatePath
  ? TPath extends readonly [...TAncestor, ...string[]]
    ? true
    : false
  : false;

type JoinStateTargetString<
  TPrefix extends string,
  TKey extends string
> = TPrefix extends '' ? TKey : `${TPrefix}.${TKey}`;

type StateTargetStringsFromStates<TStates, TPrefix extends string = ''> =
  TStates extends Record<string, unknown>
    ? {
        [K in keyof TStates & string]:
          | JoinStateTargetString<TPrefix, EscapeStatePathDots<K>>
          | (0 extends 1 & TStates[K]
              ? never
              : TStates[K] extends { states: infer TChildren }
                ? StateTargetStringsFromStates<
                    TChildren,
                    JoinStateTargetString<TPrefix, EscapeStatePathDots<K>>
                  >
                : never);
      }[keyof TStates & string]
    : never;

type IdTargetsForNode<TNode> = TNode extends { id: infer TId extends string }
  ? string extends TId
    ? never
    : TNode extends { states: infer TStates }
      ?
          | `#${EscapeStatePathDots<TId>}`
          | `#${EscapeStatePathDots<TId>}.${StateTargetStringsFromStates<TStates>}`
      : `#${EscapeStatePathDots<TId>}`
  : never;

type IdTargetsFromStates<TStates> =
  TStates extends Record<string, unknown>
    ? {
        [K in keyof TStates & string]:
          | IdTargetsForNode<TStates[K]>
          | (0 extends 1 & TStates[K]
              ? never
              : TStates[K] extends { states: infer TChildren }
                ? IdTargetsFromStates<TChildren>
                : never);
      }[keyof TStates & string]
    : never;

type AuthoredIdTargets<TConfig> =
  | IdTargetsForNode<TConfig>
  | (TConfig extends { states: infer TStates }
      ? IdTargetsFromStates<TStates>
      : never);

type ResolveIdTargetAtNode<
  TNode,
  TNodePath extends StatePath,
  TTarget extends string
> = TNode extends { id: infer TId extends string }
  ? string extends TId
    ? never
    : TTarget extends `#${EscapeStatePathDots<TId>}`
      ? TNodePath
      : TTarget extends `#${EscapeStatePathDots<TId>}.${infer TDescendant}`
        ? [...TNodePath, ...SplitStatePath<TDescendant>]
        : never
  : never;

type ResolveIdTargetInStates<
  TStates,
  TTarget extends string,
  TPrefix extends StatePath = []
> =
  TStates extends Record<string, unknown>
    ? {
        [K in keyof TStates & string]:
          | ResolveIdTargetAtNode<
              TStates[K],
              AppendStatePath<TPrefix, K>,
              TTarget
            >
          | (0 extends 1 & TStates[K]
              ? never
              : TStates[K] extends { states: infer TChildren }
                ? ResolveIdTargetInStates<
                    TChildren,
                    TTarget,
                    AppendStatePath<TPrefix, K>
                  >
                : never);
      }[keyof TStates & string]
    : never;

type ResolveIdTargetPath<TConfig, TTarget extends string> =
  | ResolveIdTargetAtNode<TConfig, [], TTarget>
  | (TConfig extends { states: infer TStates }
      ? ResolveIdTargetInStates<TStates, TTarget>
      : never);

type ResolveAuthoredTarget<
  TSourcePath extends StatePath,
  TTarget extends string
> = TTarget extends `#${string}`
  ? never
  : TTarget extends '.'
    ? TSourcePath
    : TTarget extends `.${infer TDescendant}`
      ? [...TSourcePath, ...SplitStatePath<TDescendant>]
      : [...ParentStatePath<TSourcePath>, ...SplitStatePath<TTarget>];

type StateNodeAtPath<TConfig, TPath extends StatePath> = TConfig extends {
  states: infer TStates;
}
  ? TPath extends readonly [
      infer THead extends string,
      ...infer TTail extends string[]
    ]
    ? THead extends keyof TStates
      ? TTail extends []
        ? TStates[THead]
        : StateNodeAtPath<TStates[THead], TTail>
      : never
    : TConfig
  : never;

type CommonStatePathSegments<
  TLeft extends readonly string[],
  TRight extends readonly string[],
  TCommon extends readonly string[] = []
> = TLeft extends readonly [
  infer TLeftHead extends string,
  ...infer TLeftTail extends string[]
]
  ? TRight extends readonly [
      infer TRightHead extends string,
      ...infer TRightTail extends string[]
    ]
    ? TLeftHead extends TRightHead
      ? CommonStatePathSegments<TLeftTail, TRightTail, [...TCommon, TLeftHead]>
      : TCommon
    : TCommon
  : TCommon;

type NearestCommonStatePath<
  TLeft extends StatePath,
  TRight extends StatePath
> = CommonStatePathSegments<TLeft, TRight>;

type IsAncestorStatePath<
  TAncestor extends StatePath,
  TDescendant extends StatePath
> = TDescendant extends readonly [...TAncestor, ...infer TRest]
  ? TRest extends []
    ? false
    : true
  : false;

type IsParallelStatePath<
  TConfig,
  TPath extends StatePath
> = TPath extends readonly []
  ? TConfig extends { type: 'parallel' }
    ? true
    : false
  : StateNodeAtPath<TConfig, TPath> extends { type: 'parallel' }
    ? true
    : false;

type ResolvedAuthoredTargetPath<
  TRootConfig,
  TSourcePath extends StatePath,
  TTarget
> = TTarget extends string
  ? TTarget extends `#${string}`
    ? ResolveIdTargetPath<TRootConfig, TTarget>
    : ResolveAuthoredTarget<TSourcePath, TTarget>
  : never;

type InvalidTargetPair<
  TRootConfig,
  TLeftPath extends StatePath,
  TRightPath extends StatePath
> = TLeftPath extends TRightPath
  ? TRightPath extends TLeftPath
    ? true
    : never
  : IsAncestorStatePath<TLeftPath, TRightPath> extends true
    ? true
    : IsAncestorStatePath<TRightPath, TLeftPath> extends true
      ? true
      : IsParallelStatePath<
            TRootConfig,
            NearestCommonStatePath<TLeftPath, TRightPath>
          > extends true
        ? never
        : true;

type InvalidTargetPairsWithHead<
  TRootConfig,
  TSourcePath extends StatePath,
  THead,
  TRest extends readonly unknown[]
> = TRest extends readonly [infer TNext, ...infer TTail]
  ?
      | (ResolvedAuthoredTargetPath<
          TRootConfig,
          TSourcePath,
          THead
        > extends infer THeadPath extends StatePath
          ? ResolvedAuthoredTargetPath<
              TRootConfig,
              TSourcePath,
              TNext
            > extends infer TNextPath extends StatePath
            ? InvalidTargetPair<TRootConfig, THeadPath, TNextPath>
            : never
          : never)
      | InvalidTargetPairsWithHead<TRootConfig, TSourcePath, THead, TTail>
  : never;

type InvalidTargetSet<
  TRootConfig,
  TSourcePath extends StatePath,
  TTargets
> = TTargets extends readonly [infer THead, ...infer TRest]
  ?
      | InvalidTargetPairsWithHead<TRootConfig, TSourcePath, THead, TRest>
      | InvalidTargetSet<TRootConfig, TSourcePath, TRest>
  : never;

type InvalidTargetValue<
  TRootConfig,
  TSourcePath extends StatePath,
  TTarget
> = TTarget extends string
  ? string extends TTarget
    ? never
    : TTarget extends `#${string}`
      ? TTarget extends AuthoredIdTargets<TRootConfig>
        ? never
        : TTarget
      : ResolveAuthoredTarget<
            TSourcePath,
            TTarget
          > extends infer TResolvedTarget extends StatePath
        ? TResolvedTarget extends AuthoredStatePaths<TRootConfig>
          ? never
          : true extends IsWithinStatePath<
                TResolvedTarget,
                OpaqueStatePaths<TRootConfig>
              >
            ? never
            : TTarget
        : TTarget
  : TTarget extends readonly unknown[]
    ? InvalidTargetValue<TRootConfig, TSourcePath, TTarget[number]>
    : never;

type InvalidTransitionTarget<
  TRootConfig,
  TSourcePath extends StatePath,
  TTransition
> = 0 extends 1 & TTransition
  ? never
  : TTransition extends (...args: any[]) => any
    ? InvalidTransitionTarget<TRootConfig, TSourcePath, ReturnType<TTransition>>
    : TTransition extends readonly unknown[]
      ? InvalidTransitionTarget<TRootConfig, TSourcePath, TTransition[number]>
      : TTransition extends { target: infer TTarget }
        ?
            | InvalidTargetValue<TRootConfig, TSourcePath, TTarget>
            | InvalidTargetSet<TRootConfig, TSourcePath, TTarget>
        : never;

type InvalidTransitionMapTargets<
  TRootConfig,
  TSourcePath extends StatePath,
  TTransitionMap
> = 0 extends 1 & TTransitionMap
  ? never
  : TTransitionMap extends Record<string, unknown>
    ? {
        [K in keyof TTransitionMap]: InvalidTransitionTarget<
          TRootConfig,
          TSourcePath,
          TTransitionMap[K]
        >;
      }[keyof TTransitionMap]
    : never;

type InvalidInvokeTargets<
  TRootConfig,
  TSourcePath extends StatePath,
  TInvoke
> = 0 extends 1 & TInvoke
  ? never
  : TInvoke extends readonly unknown[]
    ? InvalidInvokeTargets<TRootConfig, TSourcePath, TInvoke[number]>
    : TInvoke extends Record<string, unknown>
      ?
          | (TInvoke extends { onDone: infer TOnDone }
              ? InvalidTransitionTarget<TRootConfig, TSourcePath, TOnDone>
              : never)
          | (TInvoke extends { onError: infer TOnError }
              ? InvalidTransitionTarget<TRootConfig, TSourcePath, TOnError>
              : never)
          | (TInvoke extends { onSnapshot: infer TOnSnapshot }
              ? InvalidTransitionTarget<TRootConfig, TSourcePath, TOnSnapshot>
              : never)
          | (TInvoke extends { onTimeout: infer TOnTimeout }
              ? InvalidTransitionTarget<TRootConfig, TSourcePath, TOnTimeout>
              : never)
      : never;

type InvalidNodeTargets<
  TRootConfig,
  TNode,
  TSourcePath extends StatePath
> = 0 extends 1 & TNode
  ? never
  :
      | (TNode extends {
          initial: infer TInitial;
          states: infer TChildStates;
        }
          ? (
              TInitial extends { target: infer TInitialTarget }
                ? TInitialTarget
                : TInitial
            ) extends infer TInitialTarget
            ? TInitialTarget extends string
              ? string extends TInitialTarget
                ? never
                : TInitialTarget extends keyof TChildStates
                  ? never
                  : TInitialTarget
              : never
            : never
          : never)
      | (TNode extends { on: infer TOn }
          ? InvalidTransitionMapTargets<TRootConfig, TSourcePath, TOn>
          : never)
      | (TNode extends { always: infer TAlways }
          ? InvalidTransitionTarget<TRootConfig, TSourcePath, TAlways>
          : never)
      | (TNode extends { choice: infer TChoice }
          ? InvalidTransitionTarget<TRootConfig, TSourcePath, TChoice>
          : never)
      | (TNode extends { after: infer TAfter }
          ? InvalidTransitionMapTargets<TRootConfig, TSourcePath, TAfter>
          : never)
      | (TNode extends { onDone: infer TOnDone }
          ? InvalidTransitionTarget<TRootConfig, TSourcePath, TOnDone>
          : never)
      | (TNode extends { onError: infer TOnError }
          ? InvalidTransitionTarget<TRootConfig, TSourcePath, TOnError>
          : never)
      | (TNode extends { onTimeout: infer TOnTimeout }
          ? InvalidTransitionTarget<TRootConfig, TSourcePath, TOnTimeout>
          : never)
      | (TNode extends { invoke: infer TInvoke }
          ? InvalidInvokeTargets<TRootConfig, TSourcePath, TInvoke>
          : never)
      | (TNode extends { target: infer THistoryTarget }
          ? InvalidTargetValue<TRootConfig, TSourcePath, THistoryTarget>
          : never);

type InvalidTargetsInStates<
  TRootConfig,
  TStates,
  TPrefix extends StatePath = []
> =
  TStates extends Record<string, unknown>
    ? {
        [K in keyof TStates & string]: 0 extends 1 & TStates[K]
          ? never
          :
              | InvalidNodeTargets<
                  TRootConfig,
                  TStates[K],
                  AppendStatePath<TPrefix, K>
                >
              | (TStates[K] extends { states: infer TChildren }
                  ? InvalidTargetsInStates<
                      TRootConfig,
                      TChildren,
                      AppendStatePath<TPrefix, K>
                    >
                  : never);
      }[keyof TStates & string]
    : never;

/**
 * Rejects authored literal transition targets that do not resolve in the
 * machine topology.
 */
export type ValidateStateTargets<TConfig> = 0 extends 1 & TConfig
  ? unknown
  : TConfig extends { states: infer TStates }
    ?
        | (TConfig extends { initial: infer TInitial }
            ? (
                TInitial extends { target: infer TInitialTarget }
                  ? TInitialTarget
                  : TInitial
              ) extends infer TInitialTarget
              ? TInitialTarget extends string
                ? string extends TInitialTarget
                  ? never
                  : TInitialTarget extends keyof TStates
                    ? never
                    : TInitialTarget
                : never
              : never
            : never)
        | InvalidNodeTargets<TConfig, TConfig, []>
        | InvalidTargetsInStates<TConfig, TStates> extends never
      ? unknown
      : never
    : unknown;
