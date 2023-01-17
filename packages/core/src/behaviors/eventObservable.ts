import { Subscribable, Lazy, Behavior, EventObject } from '../types';
import { toSCXMLEvent } from '../utils';
import { ObservableInternalState, stopSignalType } from '../behaviors';

/**
 * Creates an event observable behavior that listens to an observable
 * that delivers event objects.
 *
 *
 * @param lazyObservable A function that creates an observable
 * @returns An event observable behavior
 */
export function fromEventObservable<T extends EventObject>(
  lazyObservable: Lazy<Subscribable<T>>
): Behavior<EventObject, T | undefined> {
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';

  // TODO: event types
  const behavior: Behavior<any, T | undefined, ObservableInternalState<T>> = {
    transition: (state, event) => {
      const _event = toSCXMLEvent(event);

      if (state.canceled) {
        return state;
      }

      switch (_event.name) {
        case errorEventType:
          state.status = 'error';
          state.data = _event.data.data;
          return state;
        case completeEventType:
          state.status = 'done';
          return state;
        case stopSignalType:
          state.canceled = true;
          state.subscription!.unsubscribe();
          return state;
        default:
          return state;
      }
    },
    getInitialState: () => {
      return {
        subscription: undefined,
        canceled: false,
        status: 'active',
        data: undefined
      };
    },
    start: (state, { self }) => {
      state.subscription = lazyObservable().subscribe({
        next: (value) => {
          self._parent?.send(toSCXMLEvent(value, { origin: self }));
        },
        error: (err) => {
          self.send({ type: errorEventType, data: err });
        },
        complete: () => {
          self.send({ type: completeEventType });
        }
      });

      return state;
    },
    getSnapshot: (_) => undefined,
    getStatus: (state) => state
  };

  return behavior;
}
