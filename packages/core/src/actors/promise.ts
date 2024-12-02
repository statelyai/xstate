import { XSTATE_STOP } from '../constants.ts';
import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  AnyActorRef,
  EventObject,
  MachineContext,
  NonReducibleUnknown,
  Snapshot,
  StateValue
} from '../types.ts';

export interface PromiseState {
  value?: StateValue;
  context?: MachineContext;
}

export type PromiseSnapshot<
  TOutput,
  TInput,
  TPromiseState extends PromiseState
> = Snapshot<TOutput> &
  TPromiseState & {
    input: TInput | undefined;
  };

const XSTATE_PROMISE_RESOLVE = 'xstate.promise.resolve';
const XSTATE_PROMISE_REJECT = 'xstate.promise.reject';
const XSTATE_PROMISE_UPDATE = 'xstate.promise.update';

export type PromiseActorLogic<
  TOutput,
  TInput = unknown,
  TEmitted extends EventObject = EventObject,
  TPromiseState extends PromiseState = {}
> = ActorLogic<
  PromiseSnapshot<TOutput, TInput, TPromiseState>,
  // | { type: string; [k: string]: unknown }
  | { type: typeof XSTATE_PROMISE_RESOLVE; data: TOutput }
  | { type: typeof XSTATE_PROMISE_REJECT; data: unknown }
  | { type: typeof XSTATE_STOP }
  | { type: typeof XSTATE_PROMISE_UPDATE; state: TPromiseState },
  TInput, // input
  AnyActorSystem,
  TEmitted // TEmitted
>;

/**
 * Represents an actor created by `fromPromise`.
 *
 * The type of `self` within the actor's logic.
 *
 * @example
 *
 * ```ts
 * import { fromPromise, createActor } from 'xstate';
 *
 * // The actor's resolved output
 * type Output = string;
 * // The actor's input.
 * type Input = { message: string };
 *
 * // Actor logic that fetches the url of an image of a cat saying `input.message`.
 * const logic = fromPromise<Output, Input>(async ({ input, self }) => {
 *   self;
 *   // ^? PromiseActorRef<Output, Input>
 *
 *   const data = await fetch(
 *     `https://cataas.com/cat/says/${input.message}`
 *   );
 *   const url = await data.json();
 *   return url;
 * });
 *
 * const actor = createActor(logic, { input: { message: 'hello world' } });
 * //    ^? PromiseActorRef<Output, Input>
 * ```
 *
 * @see {@link fromPromise}
 */
export type PromiseActorRef<
  TOutput,
  TPromiseState extends PromiseState = {}
> = ActorRefFromLogic<PromiseActorLogic<TOutput, unknown, any, TPromiseState>>;

const controllerMap = new WeakMap<AnyActorRef, AbortController>();

/**
 * An actor logic creator which returns promise logic as defined by an async
 * process that resolves or rejects after some time.
 *
 * Actors created from promise actor logic (“promise actors”) can:
 *
 * - Emit the resolved value of the promise
 * - Output the resolved value of the promise
 *
 * Sending events to promise actors will have no effect.
 *
 * @example
 *
 * ```ts
 * const promiseLogic = fromPromise(async () => {
 *   const result = await fetch('https://example.com/...').then((data) =>
 *     data.json()
 *   );
 *
 *   return result;
 * });
 *
 * const promiseActor = createActor(promiseLogic);
 * promiseActor.subscribe((snapshot) => {
 *   console.log(snapshot);
 * });
 * promiseActor.start();
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
 * @param promiseCreator A function which returns a Promise, and accepts an
 *   object with the following properties:
 *
 *   - `input` - Data that was provided to the promise actor
 *   - `self` - The parent actor of the promise actor
 *   - `system` - The actor system to which the promise actor belongs
 *
 * @see {@link https://stately.ai/docs/input | Input docs} for more information about how input is passed
 */
export function fromPromise<
  TOutput,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject,
  TPromiseState extends PromiseState = {}
>(
  promiseCreator: ({
    input,
    system,
    self,
    signal,
    emit,
    update
  }: {
    /** Data that was provided to the promise actor */
    input: TInput;
    /** The actor system to which the promise actor belongs */
    system: AnyActorSystem;
    /** The parent actor of the promise actor */
    self: PromiseActorRef<TOutput, TPromiseState>;
    signal: AbortSignal;
    emit: (emitted: TEmitted) => void;
    update: (state: TPromiseState) => void;
  }) => PromiseLike<TOutput>
): PromiseActorLogic<TOutput, TInput, TEmitted, TPromiseState> {
  const logic: PromiseActorLogic<TOutput, TInput, TEmitted, TPromiseState> = {
    config: promiseCreator,
    transition: (state, event, scope) => {
      if (state.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case XSTATE_PROMISE_RESOLVE: {
          const resolvedValue = event.data;
          return {
            ...state,
            status: 'done',
            output: resolvedValue,
            input: undefined
          };
        }
        case XSTATE_PROMISE_REJECT:
          return {
            ...state,
            status: 'error',
            error: event.data,
            input: undefined
          };
        case XSTATE_STOP: {
          controllerMap.get(scope.self)?.abort();
          return {
            ...state,
            status: 'stopped',
            input: undefined
          };
        }
        case XSTATE_PROMISE_UPDATE: {
          const {
            state: { context, value }
          } = event;
          return {
            ...state,
            context,
            value
          };
        }
        default:
          return state;
      }
    },
    start: (state, { self, system, emit }) => {
      // TODO: determine how to allow customizing this so that promises
      // can be restarted if necessary
      if (state.status !== 'active') {
        return;
      }
      const controller = new AbortController();
      controllerMap.set(self, controller);
      const resolvedPromise = Promise.resolve(
        promiseCreator({
          input: state.input!,
          system,
          self,
          signal: controller.signal,
          emit,
          update: (state) =>
            self.send({
              type: XSTATE_PROMISE_UPDATE,
              state
            })
        })
      );

      resolvedPromise.then(
        (response) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          controllerMap.delete(self);
          system._relay(self, self, {
            type: XSTATE_PROMISE_RESOLVE,
            data: response
          });
        },
        (errorData) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          controllerMap.delete(self);
          system._relay(self, self, {
            type: XSTATE_PROMISE_REJECT,
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
