import { ActorLogic, AnyActorSystem } from '../types';
import { stopSignalType } from '../actors';

export interface PromiseInternalState<T> {
  status: 'active' | 'error' | 'done' | 'canceled';
  data: T | undefined;
  input?: any;
}

export function fromPromise<T>(
  // TODO: add types
  promiseCreator: ({
    input,
    system
  }: {
    input: any;
    system: AnyActorSystem;
  }) => PromiseLike<T>
): ActorLogic<{ type: string }, T | undefined, PromiseInternalState<T>> {
  const resolveEventType = '$$xstate.resolve';
  const rejectEventType = '$$xstate.reject';

  // TODO: add event types
  const logic: ActorLogic<
    | {
        type: typeof resolveEventType;
        data: T;
      }
    | {
        type: typeof rejectEventType;
        data: any;
      },
    T | undefined,
    PromiseInternalState<T>
  > = {
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
