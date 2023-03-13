import {
  Subscribable,
  Lazy,
  ActorBehavior,
  EventObject,
  Subscription
} from '../types';
import { toSCXMLEvent } from '../utils';
import { stopSignalType } from '../actors';

export interface ObservableInternalState<T> {
  subscription: Subscription | undefined;
  canceled: boolean;
  status: 'active' | 'done' | 'error';
  data: T | undefined;
}

export type ObservablePersistedState<T> = Omit<
  ObservableInternalState<T>,
  'subscription'
>;

export function fromObservable<T, TEvent extends EventObject>(
  lazyObservable: Lazy<Subscribable<T>>
): ActorBehavior<
  TEvent,
  T | undefined,
  ObservableInternalState<T>,
  ObservablePersistedState<T>
> {
  const nextEventType = '$$xstate.next';
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';

  // TODO: add event types
  const behavior: ActorBehavior<
    any,
    T | undefined,
    ObservableInternalState<T>,
    ObservablePersistedState<T>
  > = {
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
          state.subscription?.unsubscribe();
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
      if (state.status === 'done') {
        // Do not restart a completed observable
        return;
      }

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
    },
    getSnapshot: (state) => state.data,
    getPersistedState: ({ canceled, status, data }) => ({
      canceled,
      status,
      data
    }),
    getStatus: (state) => state,
    restoreState: (state) => ({
      ...state,
      subscription: undefined
    })
  };

  return behavior;
}

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
): ActorBehavior<EventObject, T | undefined> {
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';

  // TODO: event types
  const behavior: ActorBehavior<
    any,
    T | undefined,
    ObservableInternalState<T>
  > = {
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
    },
    getSnapshot: (_) => undefined,
    getStatus: (state) => state
  };

  return behavior;
}
