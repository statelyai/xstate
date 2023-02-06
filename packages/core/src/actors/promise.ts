import { Lazy, ActorBehavior } from '../types';
import { toSCXMLEvent } from '../utils';
import { stopSignalType } from '../actors';

export interface PromiseInternalState<T> {
  status: 'active' | 'error' | 'done';
  canceled: boolean;
  data: T | undefined;
}

export function fromPromise<T>(
  lazyPromise: Lazy<PromiseLike<T>>
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
          return state;
        case rejectEventType:
          state.status = 'error';
          state.data = eventObject.data;
          return state;
        case stopSignalType:
          state.canceled = true;
          return state;
        default:
          return state;
      }
    },
    start: (state, { self }) => {
      const resolvedPromise = Promise.resolve(lazyPromise());

      resolvedPromise.then(
        (response) => {
          self.send({ type: resolveEventType, data: response });
        },
        (errorData) => {
          self.send({ type: rejectEventType, data: errorData });
        }
      );

      return state;
    },
    getInitialState: () => {
      return {
        canceled: false,
        status: 'active',
        data: undefined
      };
    },
    getSnapshot: (state) => state.data,
    getStatus: (state) => state,
    getPersistedState: (state) => state,
    restoreState: (state) => state
  };

  return behavior;
}
