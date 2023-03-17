import { ActorBehavior } from '../types';
import { toSCXMLEvent } from '../utils';
import { stopSignalType } from '../actors';

export interface PromiseInternalState<T> {
  status: 'active' | 'error' | 'done';
  canceled: boolean;
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

      if (state.canceled) {
        return state;
      }

      const eventObject = _event.data;

      switch (_event.name) {
        case resolveEventType:
          state.status = 'done';
          state.data = eventObject.data;
          delete state.input;
          return state;
        case rejectEventType:
          state.status = 'error';
          state.data = eventObject.data;
          delete state.input;
          return state;
        case stopSignalType:
          state.canceled = true;
          delete state.input;
          return state;
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
        canceled: false,
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

  return behavior;
}
