import { Cause, Effect, Exit, Stream } from 'effect';
import {
  createLogic,
  type ActorLogicValidator,
  type ActorLogic,
  type AnyActorLogic,
  type AnyActorRef,
  type AnyActorSystem,
  type AnyEventObject,
  type EventObject,
  type Snapshot,
  type StandardSchemaV1
} from 'xstate';
import { EffectInterruptedError } from './errors.ts';
import type { EffectRequirements } from './types.ts';
import { relayToParent, startHostedEffect } from './internal.ts';
import {
  type EffectSchemaLike,
  type ToStandardSchema,
  type ValidateEffectActorSchemas,
  toStandardSchema
} from './schema.ts';

const EFFECT_INIT = '@xstate.init';
const EFFECT_RESOLVE = 'xstate.effect.resolve';
const EFFECT_REJECT = 'xstate.effect.reject';
const EFFECT_NEXT = 'xstate.effect.next';
const EFFECT_COMPLETE = 'xstate.effect.complete';

const effectLogicBrand: unique symbol = Symbol.for(
  '@xstate/effect/logic'
) as any;

/**
 * Type-level marker attached to logic created by `fromEffect`,
 * `fromEffectStream` and `fromEffectEventStream`. It carries the logic's
 * failure type and its Effect service requirements, which is how
 * `RequirementsFrom` collects the `R` channel of `createEffectActor` without
 * inspecting the logic at runtime.
 */
export interface EffectLogicBrand<TError, TRequirements> {
  readonly [effectLogicBrand]: {
    readonly error: TError;
    readonly requirements: TRequirements;
  };
}

/**
 * Snapshot of a `fromEffect` actor. The actor holds no context of its own: it
 * is `active` while the Effect runs, `done` with the Effect's success value as
 * `output`, or `error` with the Effect's failure, defect or
 * `EffectInterruptedError` as `error`.
 */
export type EffectSnapshot<TOutput, TError, TInput> = Snapshot<TOutput> & {
  readonly context: undefined;
  readonly input: TInput | undefined;
  readonly error: TError | undefined;
};

/**
 * Argument passed to the function form of an Effect source. It gives the
 * source the actor's `input`, its own reference (`self`), the actor `system`,
 * and `emit` for publishing events that `actor.on(...)` and `emitted(actor)`
 * observe.
 */
export type EffectSourceArgs<TInput> = {
  readonly input: TInput;
  readonly self: AnyActorRef;
  readonly system: AnyActorSystem;
  /** Emits an event that can be observed with `actor.on(...)` or `emitted(actor)`. */
  readonly emit: (event: AnyEventObject) => void;
};

/**
 * What `fromEffect` accepts as its Effect: either an Effect value, or a
 * function of {@link EffectSourceArgs} returning one. The function form is
 * called once per actor start, so it sees that actor's input.
 */
export type EffectSource<TOutput, TError, TInput, TRequirements> =
  | Effect.Effect<TOutput, TError, TRequirements>
  | ((
      args: EffectSourceArgs<TInput>
    ) => Effect.Effect<TOutput, TError, TRequirements>);

type EffectActorSchemas = {
  readonly input?: EffectSchemaLike;
  readonly output?: EffectSchemaLike;
};

type EffectSourceConfig<
  TOutput,
  TError,
  TInput,
  TRequirements,
  TSchemas extends EffectActorSchemas = EffectActorSchemas,
  TValidator extends ActorLogicValidator | undefined =
    | ActorLogicValidator
    | undefined
> = {
  readonly id?: string;
  readonly validator?: TValidator;
  readonly schemas?: TSchemas &
    ([TValidator] extends [ActorLogicValidator]
      ? ValidateEffectActorSchemas<TSchemas>
      : unknown);
  readonly effect: EffectSource<TOutput, TError, TInput, TRequirements>;
};

type SchemaOutput<TSchema extends EffectSchemaLike> =
  StandardSchemaV1.InferOutput<ToStandardSchema<TSchema>>;

type EffectSuccess<T> = T extends Effect.Effect<infer A, any, any> ? A : never;

type EffectFailure<T> = T extends Effect.Effect<any, infer E, any> ? E : never;

type EffectSchemaValidationConfig<TSchemas extends EffectActorSchemas> =
  | {
      readonly validator: ActorLogicValidator;
      readonly schemas: TSchemas & ValidateEffectActorSchemas<TSchemas>;
    }
  | {
      readonly validator?: undefined;
      readonly schemas: TSchemas;
    };

/**
 * Actor logic produced by `fromEffect` and `fromEffectEventStream`. It is
 * ordinary XState actor logic carrying {@link EffectLogicBrand}, so a machine
 * can invoke or spawn it, and `createEffectActor` can collect its
 * requirements.
 */
export type EffectActorLogic<TOutput, TError, TInput, TRequirements> =
  ActorLogic<
    EffectSnapshot<TOutput, TError, TInput>,
    EventObject,
    TInput,
    AnyActorSystem
  > & { readonly id?: string } & EffectLogicBrand<TError, TRequirements>;

/**
 * Snapshot of a `fromEffectStream` actor. `context` holds the most recent
 * stream item, or `undefined` before the first one. The actor reaches `done`
 * with no output when the stream completes, and `error` when it fails.
 */
export type EffectStreamSnapshot<TItem, TError, TInput> =
  Snapshot<undefined> & {
    readonly context: TItem | undefined;
    readonly input: TInput | undefined;
    readonly error: TError | undefined;
  };

/**
 * Actor logic produced by `fromEffectStream`. Its snapshot is an
 * {@link EffectStreamSnapshot}, so the parent reads the latest item from the
 * child's `context` rather than from events.
 */
export type EffectStreamActorLogic<TItem, TError, TInput, TRequirements> =
  ActorLogic<
    EffectStreamSnapshot<TItem, TError, TInput>,
    EventObject,
    TInput,
    AnyActorSystem
  > & { readonly id?: string } & EffectLogicBrand<TError, TRequirements>;

function toError(exit: Exit.Exit<unknown, unknown>): unknown {
  if (Exit.isSuccess(exit)) {
    return undefined;
  }
  if (Cause.hasInterruptsOnly(exit.cause)) {
    return new EffectInterruptedError({
      cause: exit.cause as Cause.Cause<never>
    });
  }
  return Cause.squash(exit.cause);
}

function createSourceArgs<TInput>(
  input: TInput,
  self: AnyActorRef,
  system: AnyActorSystem
): EffectSourceArgs<TInput> {
  return {
    input,
    self,
    system,
    emit: (event) => {
      void system.emitEvent(self as any, event);
    }
  };
}

function brandLogic<TLogic extends AnyActorLogic>(
  logic: TLogic,
  error: unknown,
  requirements: unknown
): TLogic {
  Object.defineProperty(logic, effectLogicBrand, {
    configurable: false,
    enumerable: false,
    value: { error, requirements }
  });
  return logic;
}

/**
 * Creates actor logic that runs an Effect. The actor completes with the
 * Effect's success value as its output and fails with the Effect's error, its
 * squashed defect, or an `EffectInterruptedError` when the Effect interrupts
 * itself. Stopping the actor interrupts the Effect without an error. Accepts
 * an Effect, a function of {@link EffectSourceArgs} returning one, or a config
 * object with `id`, `schemas`, `validator` and `effect`. The logic must be run
 * under `createEffectActor`, which provides the Effect services it declares.
 */
export function fromEffect<
  const TInputSchema extends EffectSchemaLike,
  const TOutputSchema extends EffectSchemaLike,
  TError = unknown,
  TRequirements = never
>(
  config: Omit<
    EffectSourceConfig<
      SchemaOutput<TOutputSchema>,
      TError,
      SchemaOutput<TInputSchema>,
      TRequirements
    >,
    'schemas' | 'validator'
  > &
    EffectSchemaValidationConfig<{
      input: TInputSchema;
      output: TOutputSchema;
    }>
): EffectActorLogic<
  SchemaOutput<TOutputSchema>,
  TError,
  SchemaOutput<TInputSchema>,
  TRequirements
>;
export function fromEffect<
  const TInputSchema extends EffectSchemaLike,
  TEffect extends Effect.Effect<any, any, any>
>(
  config: Omit<
    EffectSourceConfig<
      EffectSuccess<TEffect>,
      EffectFailure<TEffect>,
      SchemaOutput<TInputSchema>,
      EffectRequirements<TEffect>,
      { input: TInputSchema }
    >,
    'effect' | 'schemas' | 'validator'
  > &
    EffectSchemaValidationConfig<{
      input: TInputSchema;
      output?: never;
    }> & {
      effect:
        | TEffect
        | ((args: EffectSourceArgs<SchemaOutput<TInputSchema>>) => TEffect);
    }
): EffectActorLogic<
  EffectSuccess<TEffect>,
  EffectFailure<TEffect>,
  SchemaOutput<TInputSchema>,
  EffectRequirements<TEffect>
>;
export function fromEffect<
  const TOutputSchema extends EffectSchemaLike,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  config: Omit<
    EffectSourceConfig<
      SchemaOutput<TOutputSchema>,
      TError,
      TInput,
      TRequirements
    >,
    'schemas' | 'validator'
  > &
    EffectSchemaValidationConfig<{
      input?: never;
      output: TOutputSchema;
    }>
): EffectActorLogic<SchemaOutput<TOutputSchema>, TError, TInput, TRequirements>;
export function fromEffect<
  TOutput,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  config: EffectSourceConfig<TOutput, TError, TInput, TRequirements> & {
    schemas?: undefined;
  }
): EffectActorLogic<TOutput, TError, TInput, TRequirements>;

export function fromEffect<TOutput, TError = unknown, TRequirements = never>(
  effect: Effect.Effect<TOutput, TError, TRequirements>
): EffectActorLogic<TOutput, TError, undefined, TRequirements>;
export function fromEffect<
  TOutput,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  effect: (
    args: EffectSourceArgs<TInput>
  ) => Effect.Effect<TOutput, TError, TRequirements>
): EffectActorLogic<TOutput, TError, TInput, TRequirements>;
export function fromEffect<
  TOutput,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  sourceOrConfig:
    | EffectSource<TOutput, TError, TInput, TRequirements>
    | EffectSourceConfig<TOutput, TError, TInput, TRequirements>
): EffectActorLogic<TOutput, TError, TInput, TRequirements> {
  const config: EffectSourceConfig<TOutput, TError, TInput, TRequirements> =
    typeof sourceOrConfig === 'function' || Effect.isEffect(sourceOrConfig)
      ? { effect: sourceOrConfig }
      : sourceOrConfig;
  const source = config.effect;
  const schemas = config.schemas
    ? {
        ...(config.schemas.input
          ? { input: toStandardSchema(config.schemas.input) }
          : {}),
        ...(config.schemas.output
          ? { output: toStandardSchema(config.schemas.output) }
          : {})
      }
    : undefined;
  const logic = createLogic<
    undefined,
    TOutput,
    EventObject,
    TInput,
    EventObject
  >({
    id: config.id,
    validator: config.validator,
    schemas,
    context: undefined,
    run: ({ event, input, self, system }, enq) => {
      if (event.type === EFFECT_RESOLVE) {
        return {
          status: 'done',
          output: (event as EventObject & { output: TOutput }).output,
          input: undefined
        };
      }

      if (event.type === EFFECT_REJECT) {
        return {
          status: 'error',
          error: (event as EventObject & { error: TError }).error,
          input: undefined
        };
      }

      if (event.type !== EFFECT_INIT) {
        return;
      }

      const effect =
        typeof source === 'function'
          ? source(createSourceArgs(input, self as AnyActorRef, system))
          : source;

      enq.effect(() =>
        startHostedEffect(
          self as AnyActorRef,
          effect as Effect.Effect<TOutput, TError>,
          'fromEffect',
          (exit) => {
            if (self.getSnapshot().status !== 'active') {
              return;
            }

            if (Exit.isSuccess(exit)) {
              self.send({ type: EFFECT_RESOLVE, output: exit.value } as any);
            } else {
              self.send({ type: EFFECT_REJECT, error: toError(exit) } as any);
            }
          }
        )
      );
    }
  });

  return brandLogic(
    logic,
    undefined as TError,
    undefined as TRequirements
  ) as unknown as EffectActorLogic<TOutput, TError, TInput, TRequirements>;
}

/**
 * What `fromEffectStream` and `fromEffectEventStream` accept as their stream:
 * either a Stream value, or a function of {@link EffectSourceArgs} returning
 * one. The function form is called once per actor start.
 */
export type EffectStreamSource<TItem, TError, TInput, TRequirements> =
  | Stream.Stream<TItem, TError, TRequirements>
  | ((
      args: EffectSourceArgs<TInput>
    ) => Stream.Stream<TItem, TError, TRequirements>);

type EffectStreamConfig<
  TItem,
  TError,
  TInput,
  TRequirements,
  TSchemas extends { readonly input?: EffectSchemaLike } = {
    readonly input?: EffectSchemaLike;
  },
  TValidator extends ActorLogicValidator | undefined =
    | ActorLogicValidator
    | undefined
> = {
  readonly id?: string;
  readonly validator?: TValidator;
  readonly schemas?: TSchemas &
    ([TValidator] extends [ActorLogicValidator]
      ? ValidateEffectActorSchemas<TSchemas>
      : unknown);
  readonly stream: EffectStreamSource<TItem, TError, TInput, TRequirements>;
};

type StreamItem<T> = T extends Stream.Stream<infer A, any, any> ? A : never;
type StreamError<T> = T extends Stream.Stream<any, infer E, any> ? E : never;
type StreamRequirements<T> =
  T extends Stream.Stream<any, any, infer R> ? R : never;

function resolveStreamConfig<TItem, TError, TInput, TRequirements>(
  sourceOrConfig:
    | EffectStreamSource<TItem, TError, TInput, TRequirements>
    | EffectStreamConfig<TItem, TError, TInput, TRequirements>
): EffectStreamConfig<TItem, TError, TInput, TRequirements> {
  return typeof sourceOrConfig === 'function' || Stream.isStream(sourceOrConfig)
    ? { stream: sourceOrConfig }
    : sourceOrConfig;
}

function toLogicSchemas(
  schemas: { readonly input?: EffectSchemaLike } | undefined
) {
  return schemas?.input
    ? { input: toStandardSchema(schemas.input) }
    : undefined;
}

/**
 * Creates actor logic that runs a Stream and exposes its most recent item as
 * the actor's `context`. The actor reaches `done` when the stream completes
 * and `error` when it fails. Accepts a Stream, a function of
 * {@link EffectSourceArgs} returning one, or a config object with `id`,
 * `schemas`, `validator` and `stream`.
 */
export function fromEffectStream<
  const TInputSchema extends EffectSchemaLike,
  TStream extends Stream.Stream<any, any, any>
>(
  config: Omit<
    EffectStreamConfig<
      StreamItem<TStream>,
      StreamError<TStream>,
      SchemaOutput<TInputSchema>,
      StreamRequirements<TStream>
    >,
    'stream' | 'schemas' | 'validator'
  > &
    EffectSchemaValidationConfig<{ input: TInputSchema }> & {
      stream:
        | TStream
        | ((args: EffectSourceArgs<SchemaOutput<TInputSchema>>) => TStream);
    }
): EffectStreamActorLogic<
  StreamItem<TStream>,
  StreamError<TStream>,
  SchemaOutput<TInputSchema>,
  StreamRequirements<TStream>
>;
export function fromEffectStream<
  TItem,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  config: EffectStreamConfig<TItem, TError, TInput, TRequirements> & {
    schemas?: undefined;
  }
): EffectStreamActorLogic<TItem, TError, TInput, TRequirements>;
export function fromEffectStream<
  TItem,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  stream: EffectStreamSource<TItem, TError, TInput, TRequirements>
): EffectStreamActorLogic<TItem, TError, TInput, TRequirements>;
export function fromEffectStream<
  TItem,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  sourceOrConfig:
    | EffectStreamSource<TItem, TError, TInput, TRequirements>
    | EffectStreamConfig<TItem, TError, TInput, TRequirements>
): EffectStreamActorLogic<TItem, TError, TInput, TRequirements> {
  const config = resolveStreamConfig(sourceOrConfig);
  const stream = config.stream;
  const logic = createLogic<
    TItem | undefined,
    undefined,
    EventObject,
    TInput,
    EventObject
  >({
    id: config.id,
    validator: config.validator,
    schemas: toLogicSchemas(config.schemas),
    context: undefined,
    run: ({ event, input, self, system }, enq) => {
      if (event.type === EFFECT_NEXT) {
        return { context: (event as EventObject & { value: TItem }).value };
      }
      if (event.type === EFFECT_COMPLETE) {
        return { status: 'done', input: undefined };
      }
      if (event.type === EFFECT_REJECT) {
        return {
          status: 'error',
          error: (event as EventObject & { error: TError }).error,
          input: undefined
        };
      }
      if (event.type !== EFFECT_INIT) {
        return;
      }

      const streamValue =
        typeof stream === 'function'
          ? stream(createSourceArgs(input, self as AnyActorRef, system))
          : stream;
      const consume = Stream.runForEach(streamValue, (value) =>
        Effect.sync(() => {
          if (self.getSnapshot().status === 'active') {
            self.send({ type: EFFECT_NEXT, value } as any);
          }
        })
      );

      enq.effect(() =>
        startHostedEffect(
          self as AnyActorRef,
          consume as Effect.Effect<void, TError>,
          'fromEffectStream',
          (exit) => {
            if (self.getSnapshot().status !== 'active') {
              return;
            }
            if (Exit.isSuccess(exit)) {
              self.send({ type: EFFECT_COMPLETE });
            } else {
              self.send({ type: EFFECT_REJECT, error: toError(exit) } as any);
            }
          }
        )
      );
    }
  });

  return brandLogic(
    logic,
    undefined as TError,
    undefined as TRequirements
  ) as unknown as EffectStreamActorLogic<TItem, TError, TInput, TRequirements>;
}

/**
 * Creates actor logic that runs a Stream of events and relays each item to the
 * parent machine as an event, the way `fromEventObservable` does. The actor
 * has no output: it reaches `done` when the stream completes and `error` when
 * it fails. Accepts the same forms as `fromEffectStream`.
 */
export function fromEffectEventStream<
  const TInputSchema extends EffectSchemaLike,
  TStream extends Stream.Stream<EventObject, any, any>
>(
  config: Omit<
    EffectStreamConfig<
      StreamItem<TStream>,
      StreamError<TStream>,
      SchemaOutput<TInputSchema>,
      StreamRequirements<TStream>
    >,
    'stream' | 'schemas' | 'validator'
  > &
    EffectSchemaValidationConfig<{ input: TInputSchema }> & {
      stream:
        | TStream
        | ((args: EffectSourceArgs<SchemaOutput<TInputSchema>>) => TStream);
    }
): EffectActorLogic<
  undefined,
  StreamError<TStream>,
  SchemaOutput<TInputSchema>,
  StreamRequirements<TStream>
>;
export function fromEffectEventStream<
  TEvent extends EventObject,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  config: EffectStreamConfig<TEvent, TError, TInput, TRequirements> & {
    schemas?: undefined;
  }
): EffectActorLogic<undefined, TError, TInput, TRequirements>;
export function fromEffectEventStream<
  TEvent extends EventObject,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  stream: EffectStreamSource<TEvent, TError, TInput, TRequirements>
): EffectActorLogic<undefined, TError, TInput, TRequirements>;
export function fromEffectEventStream<
  TEvent extends EventObject,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  sourceOrConfig:
    | EffectStreamSource<TEvent, TError, TInput, TRequirements>
    | EffectStreamConfig<TEvent, TError, TInput, TRequirements>
): EffectActorLogic<undefined, TError, TInput, TRequirements> {
  const config = resolveStreamConfig(sourceOrConfig);
  const stream = config.stream;
  const logic = createLogic<
    undefined,
    undefined,
    EventObject,
    TInput,
    EventObject
  >({
    id: config.id,
    validator: config.validator,
    schemas: toLogicSchemas(config.schemas),
    context: undefined,
    run: ({ event, input, self, system }, enq) => {
      if (event.type === EFFECT_COMPLETE) {
        return { status: 'done', input: undefined };
      }
      if (event.type === EFFECT_REJECT) {
        return {
          status: 'error',
          error: (event as EventObject & { error: TError }).error,
          input: undefined
        };
      }
      if (event.type !== EFFECT_INIT) {
        return;
      }

      const streamValue =
        typeof stream === 'function'
          ? stream(createSourceArgs(input, self as AnyActorRef, system))
          : stream;
      const consume = Stream.runForEach(streamValue, (value) =>
        Effect.sync(() => relayToParent(self as AnyActorRef, value))
      );

      enq.effect(() =>
        startHostedEffect(
          self as AnyActorRef,
          consume as Effect.Effect<void, TError>,
          'fromEffectEventStream',
          (exit) => {
            if (self.getSnapshot().status !== 'active') {
              return;
            }
            if (Exit.isSuccess(exit)) {
              self.send({ type: EFFECT_COMPLETE });
            } else {
              self.send({ type: EFFECT_REJECT, error: toError(exit) } as any);
            }
          }
        )
      );
    }
  });

  return brandLogic(
    logic,
    undefined as TError,
    undefined as TRequirements
  ) as unknown as EffectActorLogic<undefined, TError, TInput, TRequirements>;
}
