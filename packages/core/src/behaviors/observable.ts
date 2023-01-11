import { Subscribable, Lazy, Behavior, EventObject } from '../types';
import { toSCXMLEvent } from '../utils';
import { ObservableInternalState, stopSignalType } from '../behaviors';

export function fromObservable<T, TEvent extends EventObject>(
  lazyObservable: Lazy<Subscribable<T>>
): Behavior<TEvent, T | undefined> {
  const nextEventType = '$$xstate.next';
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';

  // TODO: add event types
  const behavior: Behavior<any, T | undefined, ObservableInternalState<T>> = {
    transition: (state, event, { self, id, defer }) => {
      const _event = toSCXMLEvent(event);

      if (state.canceled) {
        return state;
      }

      switch (_event.name) {
        case nextEventType:
          state.data = event.data.data;
          // match the exact timing of events sent by machines
          // send actions are not executed immediately
          defer(() => {
            self._parent?.send(
              toSCXMLEvent(
                {
                  type: `xstate.snapshot.${id}`,
                  data: _event.data.data
                },
                { origin: self }
              )
            );
          });
          return state;
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
          self.send({ type: nextEventType, data: value });
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
    getSnapshot: (state) => state.data,
    getStatus: (state) => state
  };

  return behavior;
}
