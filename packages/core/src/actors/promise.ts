import {
  ActorInternalState,
  ActorLogic,
  ActorRefFrom,
  ActorSystem,
  AnyActorSystem,
  TODO
} from '../types';
import { XSTATE_STOP } from '../constants';

export interface PromiseInternalState<TSnapshot, TInput = unknown>
  extends ActorInternalState<TSnapshot | undefined, TSnapshot> {
  input: TInput | undefined;
}

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

export type PromiseActorLogic<T, TInput = unknown> = ActorLogic<
  T | undefined,
  { type: string; [k: string]: unknown },
  TInput, // input
  T, // output
  PromiseInternalState<T, TInput>, // internal state
  PromiseInternalState<T, TInput>, // persisted state
  ActorSystem<any>
>;

export type PromiseActorRef<T> = ActorRefFrom<PromiseActorLogic<T>>;

export function fromPromise<T, TInput>(
  // TODO: add types
  promiseCreator: ({
    input,
    system
  }: {
    input: TInput;
    system: AnyActorSystem;
    self: PromiseActorRef<T>;
  }) => PromiseLike<T>
): PromiseActorLogic<T, TInput> {
  // TODO: add event types
  const logic: PromiseActorLogic<T, TInput> = {
    config: promiseCreator,
    transition: (state, event) => {
      if (state.status.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case resolveEventType: {
          const resolvedValue = (event as any).data;
          return {
            ...state,
            status: {
              status: 'done',
              output: resolvedValue
            },
            snapshot: resolvedValue,
            input: undefined
          };
        }
        case rejectEventType:
          return {
            ...state,
            status: {
              status: 'error',
              error: (event as any).data
            },
            input: undefined
          };
        case XSTATE_STOP:
          return {
            ...state,
            status: {
              status: 'stopped'
            },
            input: undefined
          };
        default:
          return state;
      }
    },
    start: (state, { self, system }) => {
      // TODO: determine how to allow customizing this so that promises
      // can be restarted if necessary
      if (state.status.status !== 'active') {
        return;
      }

      const resolvedPromise = Promise.resolve(
        promiseCreator({ input: state.input!, system, self })
      );

      resolvedPromise.then(
        (response) => {
          // TODO: remove this condition once dead letter queue lands
          if ((self as any)._state.status.status !== 'active') {
            return;
          }
          self.send({ type: resolveEventType, data: response });
        },
        (errorData) => {
          // TODO: remove this condition once dead letter queue lands
          if ((self as any)._state.status.status !== 'active') {
            return;
          }
          self.send({ type: rejectEventType, data: errorData });
        }
      );
    },
    getInitialState: (_, input) => {
      return {
        status: {
          status: 'active'
        },
        snapshot: undefined,
        input
      };
    },
    getPersistedState: (state) => state,
    restoreState: (state) => state
  };

  return logic;
}
