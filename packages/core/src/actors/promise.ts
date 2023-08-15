import {
  ActorLogic,
  ActorRefFrom,
  ActorSystem,
  AnyActorSystem
} from '../types';
import { stopSignalType } from '../actors';

export interface PromiseInternalState<T, TInput = unknown> {
  status: 'active' | 'error' | 'done' | 'canceled';
  data: T | undefined;
  input: TInput | undefined;
  controller: AbortController;
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
      type: 'xstate.stop';
    };

export type PromiseActorLogic<T, TInput = unknown> = ActorLogic<
  { type: string; [k: string]: unknown },
  T | undefined,
  PromiseInternalState<T, TInput>, // internal state
  PromiseInternalState<T, TInput>, // persisted state
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
    self: PromiseActorRef<T>;
    signal: AbortSignal;
  }) => PromiseLike<T>
): PromiseActorLogic<T, TInput> {
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
            data: (event as any).data,
            input: undefined
          };
        case rejectEventType:
          return {
            ...state,
            status: 'error',
            data: (event as any).data, // TODO: if we keep this as `data` we should reflect this in the type
            input: undefined
          };
        case stopSignalType:
          state.controller.abort('Actor recieved stop signal');
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

      const { signal } = state.controller;
      const resolvedPromise = Promise.resolve(
        promiseCreator({ input: state.input!, system, self, signal })
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
        input,
        controller: new AbortController()
      };
    },
    getSnapshot: (state) => state.data,
    getStatus: (state) => state,
    getPersistedState: (state) => state,
    restoreState: (state) => state
  };

  return logic;
}
