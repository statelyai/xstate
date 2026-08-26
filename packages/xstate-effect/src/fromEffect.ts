import { Cause, Effect, Exit, Stream } from 'effect';
import {
  createLogic,
  type ActorLogic,
  type AnyActorLogic,
  type AnyActorRef,
  type AnyActorSystem,
  type EventObject,
  type Snapshot
} from 'xstate';
import { relayToParent, startHostedEffect } from './internal.ts';

const EFFECT_INIT = '@xstate.init';
const EFFECT_RESOLVE = 'xstate.effect.resolve';
const EFFECT_REJECT = 'xstate.effect.reject';
const EFFECT_NEXT = 'xstate.effect.next';
const EFFECT_COMPLETE = 'xstate.effect.complete';

const effectLogicBrand: unique symbol = Symbol.for(
  '@xstate/effect/logic'
) as any;

export interface EffectLogicBrand<TError, TRequirements> {
  readonly [effectLogicBrand]: {
    readonly error: TError;
    readonly requirements: TRequirements;
  };
}

export type EffectSnapshot<TOutput, TError, TInput> = Snapshot<TOutput> & {
  readonly context: undefined;
  readonly input: TInput | undefined;
  readonly error: TError | undefined;
};

export type EffectSourceArgs<TInput> = {
  readonly input: TInput;
  readonly self: AnyActorRef;
};

export type EffectSource<TOutput, TError, TInput, TRequirements> =
  | Effect.Effect<TOutput, TError, TRequirements>
  | ((
      args: EffectSourceArgs<TInput>
    ) => Effect.Effect<TOutput, TError, TRequirements>);

export type EffectActorLogic<TOutput, TError, TInput, TRequirements> =
  ActorLogic<
    EffectSnapshot<TOutput, TError, TInput>,
    EventObject,
    TInput,
    AnyActorSystem
  > &
    EffectLogicBrand<TError, TRequirements>;

export type EffectStreamSnapshot<TItem, TError, TInput> =
  Snapshot<undefined> & {
    readonly context: TItem | undefined;
    readonly input: TInput | undefined;
    readonly error: TError | undefined;
  };

export type EffectStreamActorLogic<TItem, TError, TInput, TRequirements> =
  ActorLogic<
    EffectStreamSnapshot<TItem, TError, TInput>,
    EventObject,
    TInput,
    AnyActorSystem
  > &
    EffectLogicBrand<TError, TRequirements>;

function toError(exit: Exit.Exit<unknown, unknown>): unknown {
  if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) {
    return undefined;
  }
  return Cause.squash(exit.cause);
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
  source: EffectSource<TOutput, TError, TInput, TRequirements>
): EffectActorLogic<TOutput, TError, TInput, TRequirements> {
  const logic = createLogic<
    undefined,
    TOutput,
    EventObject,
    TInput,
    EventObject
  >({
    context: undefined,
    run: ({ event, input, self }, enq) => {
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
          ? source({ input, self: self as AnyActorRef })
          : source;

      enq.effect(() =>
        startHostedEffect(self as AnyActorRef, effect, (exit) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }

          if (Exit.isSuccess(exit)) {
            self.send({ type: EFFECT_RESOLVE, output: exit.value } as any);
          } else {
            const error = toError(exit);
            if (error !== undefined) {
              self.send({ type: EFFECT_REJECT, error } as any);
            }
          }
        })
      );
    }
  });

  return brandLogic(
    logic,
    undefined as TError,
    undefined as TRequirements
  ) as unknown as EffectActorLogic<TOutput, TError, TInput, TRequirements>;
}

export function fromEffectStream<
  TItem,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  stream:
    | Stream.Stream<TItem, TError, TRequirements>
    | ((
        args: EffectSourceArgs<TInput>
      ) => Stream.Stream<TItem, TError, TRequirements>)
): EffectStreamActorLogic<TItem, TError, TInput, TRequirements> {
  const logic = createLogic<
    TItem | undefined,
    undefined,
    EventObject,
    TInput,
    EventObject
  >({
    context: undefined,
    run: ({ event, input, self }, enq) => {
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
          ? stream({ input, self: self as AnyActorRef })
          : stream;
      const consume = Stream.runForEach(streamValue, (value) =>
        Effect.sync(() => {
          if (self.getSnapshot().status === 'active') {
            self.send({ type: EFFECT_NEXT, value } as any);
          }
        })
      );

      enq.effect(() =>
        startHostedEffect(self as AnyActorRef, consume, (exit) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          if (Exit.isSuccess(exit)) {
            self.send({ type: EFFECT_COMPLETE } as any);
          } else {
            const error = toError(exit);
            if (error !== undefined) {
              self.send({ type: EFFECT_REJECT, error } as any);
            }
          }
        })
      );
    }
  });

  return brandLogic(
    logic,
    undefined as TError,
    undefined as TRequirements
  ) as unknown as EffectStreamActorLogic<TItem, TError, TInput, TRequirements>;
}

export function fromEffectEventStream<
  TEvent extends EventObject,
  TError = unknown,
  TInput = undefined,
  TRequirements = never
>(
  stream:
    | Stream.Stream<TEvent, TError, TRequirements>
    | ((
        args: EffectSourceArgs<TInput>
      ) => Stream.Stream<TEvent, TError, TRequirements>)
): EffectActorLogic<undefined, TError, TInput, TRequirements> {
  const logic = createLogic<
    undefined,
    undefined,
    EventObject,
    TInput,
    EventObject
  >({
    context: undefined,
    run: ({ event, input, self }, enq) => {
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
          ? stream({ input, self: self as AnyActorRef })
          : stream;
      const consume = Stream.runForEach(streamValue, (value) =>
        Effect.sync(() => relayToParent(self as AnyActorRef, value))
      );

      enq.effect(() =>
        startHostedEffect(self as AnyActorRef, consume, (exit) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          if (Exit.isSuccess(exit)) {
            self.send({ type: EFFECT_COMPLETE } as any);
          } else {
            const error = toError(exit);
            if (error !== undefined) {
              self.send({ type: EFFECT_REJECT, error } as any);
            }
          }
        })
      );
    }
  });

  return brandLogic(
    logic,
    undefined as TError,
    undefined as TRequirements
  ) as unknown as EffectActorLogic<undefined, TError, TInput, TRequirements>;
}
