import { ActorBehavior } from '../types';
import { toSCXMLEvent } from '../utils';
import { stopSignalType } from '../actors';

export interface PromiseInternalState<T> {
  status: 'active' | 'error' | 'done' | 'canceled';
  data: T | undefined;
  input?: any;
}

export function fromPromise<T>(
  // TODO: add types
  promiseCreator: ({ input }: { input: any }) => PromiseLike<T>
): ActorBehavior<{ type: string }, T | undefined, PromiseInternalState<T>> {
  const resolveEventType = '$$xstate.resolve';
  const rejectEventType = '$$xstate.reject';

  // TODO: add event types
  const behavior: ActorBehavior<
    | { type: string }
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
    transition: (state, event) => {
      const _event = toSCXMLEvent(event);

      if (state.status !== 'active') {
        return state;
      }

      const eventObject = _event.data;

      switch (_event.name) {
        case resolveEventType:
          return {
            ...state,
            status: 'done',
            data: eventObject.data,
            input: undefined
          };
        case rejectEventType:
          return {
            ...state,
            status: 'error',
            data: eventObject.data,
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
    start: (state, { self }) => {
      // TODO: determine how to allow customizing this so that promises
      // can be restarted if necessary
      if (state.status !== 'active') {
        return;
      }

      const resolvedPromise = Promise.resolve(
        promiseCreator({ input: state.input })
      );

      resolvedPromise.then(
        (response) => {
          self.send({ type: resolveEventType, data: response });
        },
        (errorData) => {
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
    getOutput: (state) => state.data,
    restoreState: (state) => state
  };

  return behavior;
}
