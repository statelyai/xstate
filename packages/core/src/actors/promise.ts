import {
  ActorLogic,
  ActorRefFrom,
  ActorSystem,
  AnyActorSystem,
  Snapshot
} from '../types';
import { XSTATE_STOP } from '../constants';

export type PromiseSnapshot<TOutput, TInput> = Snapshot<TOutput> & {
  input: TInput | undefined;
};

const resolveEventType = '$$xstate.resolve';
const rejectEventType = '$$xstate.reject';

export type PromiseActorEvents<T> =
  | {
      type: typeof resolveEventType;
      data: T;
    }
  | {
      type: typeof rejectEventType;
      data: any;
    }
  | {
      type: typeof XSTATE_STOP;
    };

export type PromiseActorLogic<TOutput, TInput = unknown> = ActorLogic<
  PromiseSnapshot<TOutput, TInput>,
  { type: string; [k: string]: unknown },
  TInput, // input
  ActorSystem<any>
>;

export type PromiseActorRef<TOutput> = ActorRefFrom<
  PromiseActorLogic<TOutput, unknown>
>;

/**
 * An actor logic creator which returns promise logic as defined by an async process that resolves or rejects after some time.
 *
 * Actors created from promise actor logic (“promise actors”) can:
 * - Emit the resolved value of the promise
 * - Output the resolved value of the promise
 *
 * Sending events to promise actors will have no effect.
 *
 * @param promiseCreator
 *   A function which returns a Promise, and accepts an object with the following properties:
 *   - `input` - Data that was provided to the promise actor
 *   - `self` - The parent actor of the promise actor
 *   - `system` - The actor system to which the promise actor belongs
 * @see {@link https://stately.ai/docs/input | Input docs} for more information about how input is passed
 *
 * @example
 * ```ts
 * const promiseLogic = fromPromise(() => {
 *   return fetch('https://example.com/...').then((data) => data.json());
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
 */
export function fromPromise<TOutput, TInput = unknown>(
  // TODO: add types
  promiseCreator: ({
    input,
    system
  }: {
    /**
     * Data that was provided to the promise actor
     */
    input: TInput;
    /**
     * The actor system to which the promise actor belongs
     */
    system: AnyActorSystem;
    /**
     * The parent actor of the promise actor
     */
    self: PromiseActorRef<TOutput>;
  }) => PromiseLike<TOutput>
): PromiseActorLogic<TOutput, TInput> {
  // TODO: add event types
  const logic: PromiseActorLogic<TOutput, TInput> = {
    config: promiseCreator,
    transition: (state, event) => {
      if (state.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case resolveEventType: {
          const resolvedValue = (event as any).data;
          return {
            ...state,
            status: 'done',
            output: resolvedValue,
            input: undefined
          };
        }
        case rejectEventType:
          return {
            ...state,
            status: 'error',
            error: (event as any).data,
            input: undefined
          };
        case XSTATE_STOP:
          return {
            ...state,
            status: 'stopped',
            input: undefined
          };
        default:
          return state;
      }
    },
    start: (state, { self, system }) => {
      // TODO: determine how to allow customizing this so that promises
      // can be restarted if necessary
      if (state.status !== 'active') {
        return;
      }

      const resolvedPromise = Promise.resolve(
        promiseCreator({ input: state.input!, system, self })
      );

      resolvedPromise.then(
        (response) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          system._relay(self, self, { type: resolveEventType, data: response });
        },
        (errorData) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          system._relay(self, self, { type: rejectEventType, data: errorData });
        }
      );
    },
    getInitialState: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        input
      };
    },
    getPersistedState: (state) => state,
    restoreState: (state: any) => state
  };

  return logic;
}
