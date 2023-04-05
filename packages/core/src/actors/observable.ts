import {
  Subscribable,
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
  input?: any;
}

export type ObservablePersistedState<T> = Omit<
  ObservableInternalState<T>,
  'subscription'
>;

// TODO: this likely shouldn't accept TEvent, observable actor doesn't accept external events
export function fromObservable<T, TEvent extends EventObject>(
  observableCreator: ({ input }: { input: any }) => Subscribable<T>
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
          return {
            ...state,
            data: event.data.data
          };
        case errorEventType:
          return {
            ...state,
            status: 'error',
            input: undefined,
            data: _event.data.data,
            subscription: undefined
          };
        case completeEventType:
          return {
            ...state,
            status: 'done',
            input: undefined,
            subscription: undefined
          };
        case stopSignalType:
          state.subscription!.unsubscribe();
          return {
            ...state,
            input: undefined,
            canceled: true,
            subscription: undefined
          };
        default:
          return state;
      }
    },
    getInitialState: (_, input) => {
      return {
        subscription: undefined,
        canceled: false,
        status: 'active',
        data: undefined,
        input
      };
    },
    start: (state, { self }) => {
      if (state.status === 'done') {
        // Do not restart a completed observable
        return;
      }
      state.subscription = observableCreator({ input: state.input }).subscribe({
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
    getPersistedState: ({ canceled, status, data, input }) => ({
      canceled,
      status,
      data,
      input
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
  lazyObservable: ({ input }: { input: any }) => Subscribable<T>
): ActorBehavior<EventObject, T | undefined> {
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';

  // TODO: event types
  const behavior: ActorBehavior<
    any,
    T | undefined,
    ObservableInternalState<T>,
    ObservablePersistedState<T>
  > = {
    transition: (state, event) => {
      const _event = toSCXMLEvent(event);

      if (state.canceled) {
        return state;
      }

      switch (_event.name) {
        case errorEventType:
          return {
            ...state,
            status: 'error',
            input: undefined,
            data: _event.data.data,
            subscription: undefined
          };
        case completeEventType:
          return {
            ...state,
            status: 'done',
            input: undefined,
            subscription: undefined
          };
        case stopSignalType:
          state.subscription!.unsubscribe();
          return {
            ...state,
            canceled: true,
            input: undefined,
            subscription: undefined
          };
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

      state.subscription = lazyObservable({ input: state.input }).subscribe({
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
    getPersistedState: ({ canceled, status, data, input }) => ({
      canceled,
      status,
      data,
      input
    }),
    getStatus: (state) => state,
    restoreState: (state) => ({
      ...state,
      subscription: undefined
    })
  };

  return behavior;
}
