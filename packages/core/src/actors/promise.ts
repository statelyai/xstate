import { XSTATE_STOP } from '../constants.ts';
import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorRefFrom,
  ActorScope,
  AnyActorRef,
  NonReducibleUnknown,
  Snapshot
} from '../types.ts';

export type PromiseSnapshot<TOutput, TInput> = Snapshot<TOutput> & {
  input: TInput | undefined;
  children: Record<string, any>;
};

const XSTATE_PROMISE_RESOLVE = 'xstate.promise.resolve';
const XSTATE_PROMISE_REJECT = 'xstate.promise.reject';
const XSTATE_SPAWN_CHILD = 'xstate.spawn.child';

export type PromiseActorLogic<TOutput, TInput = unknown> = ActorLogic<
  PromiseSnapshot<TOutput, TInput>,
  { type: string; [k: string]: unknown },
  TInput, // input
  AnyActorSystem
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
 * const promiseLogic = fromPromise(async () => {
 *   const result = await fetch('https://example.com/...')
 *     .then((data) => data.json());
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
 */
export function fromPromise<TOutput, TInput = NonReducibleUnknown>(
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
    spawnChild: ActorScope<any, any, any>['spawnChild'];
  }) => PromiseLike<TOutput>
): PromiseActorLogic<TOutput, TInput> {
  const logic: PromiseActorLogic<TOutput, TInput> = {
    config: promiseCreator,
    transition: (state, event, actorScope) => {
      if (state.status !== 'active') {
        return state;
      }

      const stopChildren = () => {
        for (const child of Object.values(state.children)) {
          actorScope.stopChild(child);
        }
      };

      switch (event.type) {
        case XSTATE_PROMISE_RESOLVE: {
          stopChildren();
          const resolvedValue = (event as any).data;
          return {
            ...state,
            status: 'done',
            output: resolvedValue,
            input: undefined
          };
        }
        case XSTATE_PROMISE_REJECT:
          stopChildren();
          return {
            ...state,
            status: 'error',
            error: (event as any).data,
            input: undefined
          };
        case XSTATE_STOP:
          stopChildren();
          return {
            ...state,
            status: 'stopped',
            input: undefined
          };
        case XSTATE_SPAWN_CHILD: {
          return {
            ...state,
            children: {
              ...state.children,
              [(event as any).child.id]: (event as any).child
            }
          };
        }
        default:
          return state;
      }
    },
    start: (state, { self, system, spawnChild }) => {
      // TODO: determine how to allow customizing this so that promises
      // can be restarted if necessary
      if (state.status !== 'active') {
        return;
      }

      const innerSpawnChild: typeof spawnChild<any> = (logic, actorOptions) => {
        const child = spawnChild(logic, actorOptions) as AnyActorRef;

        self.send({
          type: XSTATE_SPAWN_CHILD,
          child
        });

        return child;
      };

      const resolvedPromise = Promise.resolve(
        promiseCreator({
          input: state.input!,
          system,
          self,
          spawnChild: innerSpawnChild as any
        })
      );

      resolvedPromise.then(
        (response) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          system._relay(self, self, {
            type: XSTATE_PROMISE_RESOLVE,
            data: response
          });
        },
        (errorData) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
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
        input,
        children: {}
      };
    },
    getPersistedSnapshot: (snapshot) => snapshot,
    restoreSnapshot: (snapshot: any) => snapshot
  };

  return logic;
}
