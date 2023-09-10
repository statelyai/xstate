import {
  ActorLogic,
  ActorRefFrom,
  ActorSystem,
  AnyActorSystem
} from '../types';
import { XSTATE_STOP } from '../constants';

export interface PromiseInternalState<T, TInput = unknown> {
  status: 'active' | 'error' | 'done' | 'canceled';
  data: T | undefined;
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
  }) => PromiseLike<T>
): PromiseActorLogic<T, TInput> {
  // TODO: add event types
  const logic: PromiseActorLogic<T, TInput> = {
    name: 'promise',
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
        case XSTATE_STOP:
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
        promiseCreator({ input: state.input!, system, self })
      );

      resolvedPromise.then(
        (response) => {
          // TODO: remove this condition once dead letter queue lands
          if ((self as any)._state.status !== 'active') {
            return;
          }
          system.sendTo(self, { type: resolveEventType, data: response }, self);
        },
        (errorData) => {
          // TODO: remove this condition once dead letter queue lands
          if ((self as any)._state.status !== 'active') {
            return;
          }
          system.sendTo(self, { type: rejectEventType, data: errorData }, self);
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
