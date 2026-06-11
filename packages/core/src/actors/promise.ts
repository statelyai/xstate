import { parseDelayToMilliseconds } from '../delay.ts';
import { XSTATE_INIT } from '../constants.ts';
import { StandardSchemaV1 } from '../schema.types.ts';
import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  EventObject,
  NonReducibleUnknown,
  Snapshot
} from '../types.ts';
import {
  XSTATE_LOGIC_EFFECT_REJECT,
  XSTATE_LOGIC_EFFECT_RESOLVE,
  XSTATE_LOGIC_EFFECT_START,
  createLogic as createBaseLogic
} from './logic.ts';

export type AsyncSnapshot<TOutput, TInput> = Snapshot<TOutput> & {
  input: TInput | undefined;
  effects?: Record<
    string,
    | { status: 'active' }
    | { status: 'done'; output?: unknown }
    | { status: 'error'; error: unknown }
  >;
};

const XSTATE_ASYNC_RESOLVE = 'xstate.async.resolve';
const XSTATE_ASYNC_REJECT = 'xstate.async.reject';

export type AsyncActorLogic<
  TOutput,
  TInput = unknown,
  TEmitted extends EventObject = EventObject
> = ActorLogic<
  AsyncSnapshot<TOutput, TInput>,
  { type: string; [k: string]: unknown },
  TInput,
  AnyActorSystem,
  TEmitted
>;

export type AsyncActorRef<TOutput> = ActorRefFromLogic<
  AsyncActorLogic<TOutput, unknown>
>;

export interface LogicArgs<TOutput, TInput> {
  /** Data that was provided to the async actor. */
  input: TInput;
  /** The actor system to which the async actor belongs. */
  system: AnyActorSystem;
  /** The async actor ref. */
  self: AsyncActorRef<TOutput>;
  /** Aborted when the async actor is stopped or times out. */
  signal: AbortSignal;
}

export interface LogicEnqueue<TEmitted extends EventObject> {
  /** Emits an event that can be observed with `actor.on(...)`. */
  emit: (emitted: TEmitted) => void;
  /** Executes async work as a durable effect keyed by `key`. */
  step: <TStepOutput>(
    key: string,
    exec: () => TStepOutput | PromiseLike<TStepOutput>
  ) => Promise<TStepOutput>;
}

export type LogicFunction<
  TOutput,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
> = (
  args: LogicArgs<TOutput, TInput>,
  enq: LogicEnqueue<TEmitted>
) => PromiseLike<TOutput>;

export interface LogicConfig<
  TOutput,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject,
  TInputSchema extends StandardSchemaV1 = StandardSchemaV1
> {
  /**
   * Stable identifier for this async logic. This identifies the logic, not a
   * particular actor instance.
   */
  id?: string;
  /** Schemas for inferring async logic types. */
  schemas?: {
    input?: TInputSchema;
  };
  /** Maximum time this async logic may run before it is aborted and errors. */
  timeout?: number | string;
  /** The async work to execute when the actor starts. */
  run: LogicFunction<TOutput, TInput, TEmitted>;
}

export class TimeoutError extends Error {
  constructor(timeout: number | string) {
    super(`Async logic timed out after ${timeout}.`);
    this.name = 'TimeoutError';
  }
}

/**
 * Represents an actor created by `createAsyncLogic`.
 *
 * The type of `self` within the actor's logic.
 *
 * @example
 *
 * ```ts
 * import { createAsyncLogic, createActor } from 'xstate';
 *
 * // The actor's resolved output
 * type Output = string;
 * // The actor's input.
 * type Input = { message: string };
 *
 * // Actor logic that fetches the url of an image of a cat saying `input.message`.
 * const logic = createAsyncLogic<Output, Input>({
 *   run: async ({ input, self }, enq) => {
 *     self;
 *     // ^? AsyncActorRef<Output>
 *     enq.emit({ type: 'request.start' });
 *
 *     const data = await fetch(
 *       `https://cataas.com/cat/says/${input.message}`
 *     );
 *     const url = await data.json();
 *     return url;
 *   }
 * });
 *
 * const actor = createActor(logic, { input: { message: 'hello world' } });
 * //    ^? AsyncActorRef<Output>
 * ```
 *
 * @see {@link createAsyncLogic}
 */

/**
 * An actor logic creator which returns async logic as defined by an async
 * process that resolves or rejects after some time.
 *
 * Actors created from async actor logic can:
 *
 * - Output the resolved value of the async process
 * - Error with the rejected value of the async process
 * - Abort when stopped or timed out
 *
 * Sending events to async actors will have no effect.
 *
 * @example
 *
 * ```ts
 * const asyncLogic = createAsyncLogic({
 *   id: 'fetch-user',
 *   timeout: '30s',
 *   run: async ({ signal }, enq) => {
 *     enq.emit({ type: 'request.start' });
 *     const result = await fetch('https://example.com/...', {
 *       signal
 *     }).then((data) => data.json());
 *
 *     return result;
 *   }
 * });
 *
 * const asyncActor = createActor(asyncLogic);
 * asyncActor.subscribe((snapshot) => {
 *   console.log(snapshot);
 * });
 * asyncActor.start();
 * // => {
 * //   output: undefined,
 * //   status: 'active'
 * //   ...
 * // }
 *
 * // After promise resolves
 * // => {
 * //   output: { ... },
 * //   status: 'done',
 * //   ...
 * // }
 * ```
 *
 * @param asyncLogic A config object with a `run` function which returns a
 *   Promise, and accepts an object with the following properties:
 *
 *   - `input` - Data that was provided to the async actor
 *   - `self` - The async actor ref
 *   - `system` - The actor system to which the async actor belongs
 *   - `signal` - An abort signal for cancellation
 *
 *   `run` also receives an `enq` object with the following properties:
 *
 *   - `emit` - Emits an event that can be observed with `actor.on(...)`
 *
 * @see {@link https://stately.ai/docs/input | Input docs} for more information about how input is passed
 */
export function createAsyncLogic<
  TOutput,
  const TInputSchema extends StandardSchemaV1,
  TEmitted extends EventObject = EventObject
>(
  asyncLogic: LogicConfig<
    TOutput,
    StandardSchemaV1.InferOutput<TInputSchema>,
    TEmitted,
    TInputSchema
  > & {
    schemas: {
      input: TInputSchema;
    };
  }
): AsyncActorLogic<
  TOutput,
  StandardSchemaV1.InferOutput<TInputSchema>,
  TEmitted
> & { id?: string };
export function createAsyncLogic<
  TOutput,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  asyncLogic: LogicConfig<TOutput, TInput, TEmitted>
): AsyncActorLogic<TOutput, TInput, TEmitted> & { id?: string };
export function createAsyncLogic<
  TOutput,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  asyncLogic: LogicConfig<TOutput, TInput, TEmitted>
): AsyncActorLogic<TOutput, TInput, TEmitted> & { id?: string } {
  const config = asyncLogic;

  function waitForEffect<TStepOutput>(
    self: AsyncActorRef<TOutput>,
    key: string
  ): Promise<TStepOutput> {
    return new Promise((resolve, reject) => {
      const subscription = self.subscribe((snapshot) => {
        const effect = snapshot.effects?.[key];

        if (effect?.status === 'done') {
          subscription.unsubscribe();
          resolve(effect.output as TStepOutput);
        } else if (effect?.status === 'error') {
          subscription.unsubscribe();
          reject(effect.error);
        }
      });
    });
  }

  return createBaseLogic<
    undefined,
    TOutput,
    { type: string; [k: string]: unknown },
    TInput,
    TEmitted
  >({
    id: config.id,
    schemas: config.schemas,
    context: undefined,
    run: ({ event, input, self, system }, enq) => {
      switch (event.type) {
        case XSTATE_ASYNC_RESOLVE: {
          const resolvedValue = (event as any).data ?? (event as any).output;
          return {
            status: 'done',
            output: resolvedValue,
            input: undefined as TInput | undefined,
            effects: {
              async: { status: 'done', output: resolvedValue }
            }
          };
        }
        case XSTATE_ASYNC_REJECT: {
          const error = (event as any).data ?? (event as any).error;
          return {
            status: 'error',
            error,
            input: undefined as TInput | undefined,
            effects: {
              async: { status: 'error', error }
            }
          };
        }
      }

      if (event.type !== XSTATE_INIT) {
        return;
      }

      enq.effect(() => {
        const controller = new AbortController();
        const timeout = config.timeout;
        const timeoutMs = parseDelayToMilliseconds(timeout);
        const timeoutId =
          timeoutMs === undefined
            ? undefined
            : system._clock.setTimeout(() => {
                if (self.getSnapshot().status !== 'active') {
                  return;
                }
                controller.abort();
                system._relay(self, self, {
                  type: XSTATE_ASYNC_REJECT,
                  data: new TimeoutError(timeout!)
                });
              }, timeoutMs);

        const clearTimeout = () => {
          if (timeoutId !== undefined) {
            system._clock.clearTimeout(timeoutId);
          }
        };

        const resolvedPromise = Promise.resolve(
          config.run(
            {
              input,
              system,
              self: self as any,
              signal: controller.signal
            },
            {
              emit: enq.emit,
              step: async (key, exec) => {
                const effect = self.getSnapshot().effects?.[key];

                if (effect?.status === 'done') {
                  return effect.output as any;
                }

                if (effect?.status === 'error') {
                  throw effect.error;
                }

                if (effect?.status === 'active') {
                  return waitForEffect(self as any, key) as any;
                }

                system._relay(self, self, {
                  type: XSTATE_LOGIC_EFFECT_START,
                  key
                });

                try {
                  const output = await exec();
                  system._relay(self, self, {
                    type: XSTATE_LOGIC_EFFECT_RESOLVE,
                    key,
                    output
                  });
                  return output;
                } catch (error) {
                  system._relay(self, self, {
                    type: XSTATE_LOGIC_EFFECT_REJECT,
                    key,
                    error
                  });
                  throw error;
                }
              }
            }
          )
        );

        resolvedPromise.then(
          (response) => {
            clearTimeout();
            if (self.getSnapshot().status !== 'active') {
              return;
            }
            system._relay(self, self, {
              type: XSTATE_ASYNC_RESOLVE,
              data: response
            });
          },
          (errorData) => {
            clearTimeout();
            if (self.getSnapshot().status !== 'active') {
              return;
            }
            system._relay(self, self, {
              type: XSTATE_ASYNC_REJECT,
              data: errorData
            });
          }
        );

        return () => {
          controller.abort();
          clearTimeout();
        };
      });

      return {
        effects: {
          async: { status: 'active' }
        }
      };
    }
  }) as unknown as AsyncActorLogic<TOutput, TInput, TEmitted> & { id?: string };
}
