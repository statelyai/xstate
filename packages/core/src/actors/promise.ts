import { XSTATE_STOP } from '../constants.ts';
import { parseDelayToMilliseconds } from '../delay.ts';
import { StandardSchemaV1 } from '../schema.types.ts';
import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  AnyActorRef,
  EventObject,
  NonReducibleUnknown,
  Snapshot
} from '../types.ts';

export type AsyncSnapshot<TOutput, TInput> = Snapshot<TOutput> & {
  input: TInput | undefined;
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
 * Represents an actor created by `createLogic`.
 *
 * The type of `self` within the actor's logic.
 *
 * @example
 *
 * ```ts
 * import { createLogic, createActor } from 'xstate';
 *
 * // The actor's resolved output
 * type Output = string;
 * // The actor's input.
 * type Input = { message: string };
 *
 * // Actor logic that fetches the url of an image of a cat saying `input.message`.
 * const logic = createLogic<Output, Input>({
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
 * @see {@link createLogic}
 */

const instanceStates = new WeakMap<
  AnyActorRef,
  { controller: AbortController; timeoutId: unknown | undefined }
>();

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
 * const asyncLogic = createLogic({
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
export function createLogic<
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
export function createLogic<
  TOutput,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  asyncLogic: LogicConfig<TOutput, TInput, TEmitted>
): AsyncActorLogic<TOutput, TInput, TEmitted> & { id?: string };
export function createLogic<
  TOutput,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  asyncLogic: LogicConfig<TOutput, TInput, TEmitted>
): AsyncActorLogic<TOutput, TInput, TEmitted> & { id?: string } {
  const config = asyncLogic;

  const logic: AsyncActorLogic<TOutput, TInput, TEmitted> & { id?: string } = {
    id: config.id,
    config,
    transition: (state, event, scope) => {
      if (state.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case XSTATE_ASYNC_RESOLVE: {
          const resolvedValue = (event as any).data;
          const instanceState = instanceStates.get(scope.self);
          if (instanceState?.timeoutId !== undefined) {
            scope.system._clock.clearTimeout(instanceState.timeoutId);
          }
          instanceStates.delete(scope.self);
          return {
            ...state,
            status: 'done',
            output: resolvedValue,
            input: undefined
          };
        }
        case XSTATE_ASYNC_REJECT: {
          const instanceState = instanceStates.get(scope.self);
          if (instanceState?.timeoutId !== undefined) {
            scope.system._clock.clearTimeout(instanceState.timeoutId);
          }
          instanceStates.delete(scope.self);
          return {
            ...state,
            status: 'error',
            error: (event as any).data,
            input: undefined
          };
        }
        case XSTATE_STOP: {
          const instanceState = instanceStates.get(scope.self);
          instanceState?.controller.abort();
          if (instanceState?.timeoutId !== undefined) {
            scope.system._clock.clearTimeout(instanceState.timeoutId);
          }
          instanceStates.delete(scope.self);
          return {
            ...state,
            status: 'stopped',
            input: undefined
          };
        }
        default:
          return state;
      }
    },
    start: (state, { self, system, emit }) => {
      // TODO: determine how to allow customizing this so that async logic can
      // be restarted if necessary.
      if (state.status !== 'active') {
        return;
      }
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

      instanceStates.set(self, { controller, timeoutId });

      const resolvedPromise = Promise.resolve(
        config.run(
          {
            input: state.input!,
            system,
            self,
            signal: controller.signal
          },
          { emit }
        )
      );

      resolvedPromise.then(
        (response) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          system._relay(self, self, {
            type: XSTATE_ASYNC_RESOLVE,
            data: response
          });
        },
        (errorData) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          system._relay(self, self, {
            type: XSTATE_ASYNC_REJECT,
            data: errorData
          });
        }
      );
    },
    getInitialSnapshot: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        input
      };
    },
    getPersistedSnapshot: (snapshot) => snapshot,
    restoreSnapshot: (snapshot: any) => snapshot
  };

  return logic;
}
