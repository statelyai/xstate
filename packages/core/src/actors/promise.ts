import {
  ActorLogic,
  ActorRefFrom,
  ActorSystem,
  AnyActorSystem
} from '../types';
import { stopSignalType } from '../actors';

export interface PromiseInternalState<T> {
  status: 'active' | 'error' | 'done' | 'canceled';
  data: T | undefined;
  input?: any;
}

type PromiseActorEvents<T> =
  | {
      type: '$$xstate.resolve';
      data: T;
    }
  | {
      type: '$$xstate.reject';
      data: unknown;
    };

export type PromiseActorLogic<T, TInput = any> = ActorLogic<
  PromiseActorEvents<T>,
  T | undefined,
  PromiseInternalState<T>, // internal state
  PromiseInternalState<T>, // persisted state
  ActorSystem<any>,
  TInput, // input
  T // output
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
  }) => PromiseLike<T>
): PromiseActorLogic<T, TInput> {
  const resolveEventType = '$$xstate.resolve';
  const rejectEventType = '$$xstate.reject';

  // TODO: add event types
  const logic: PromiseActorLogic<T, TInput> = {
    config: promiseCreator,
    transition: (state, event) => {
      if (state.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case resolveEventType:
          return {
            ...state,
            status: 'done',
            data: event.data,
            input: undefined
          };
        case rejectEventType:
          return {
            ...state,
            status: 'error',
            data: (event as any).data,
            input: undefined
          };
        case stopSignalType:
          return {
            ...state,
            status: 'canceled',
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
        promiseCreator({ input: state.input, system })
      );

      resolvedPromise.then(
        (response) => {
          // TODO: remove this condition once dead letter queue lands
          if ((self as any)._state.status !== 'active') {
            return;
          }
          self.send({ type: resolveEventType, data: response });
        },
        (errorData) => {
          // TODO: remove this condition once dead letter queue lands
          if ((self as any)._state.status !== 'active') {
            return;
          }
          self.send({ type: rejectEventType, data: errorData });
        }
      );
    },
    getInitialState: (_, input) => {
      return {
        status: 'active',
        data: undefined,
        input
      };
    },
    getSnapshot: (state) => state.data,
    getStatus: (state) => state,
    getPersistedState: (state) => state,
    restoreState: (state) => state
  };

  return logic;
}
