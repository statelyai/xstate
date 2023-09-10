import { XSTATE_STOP } from '../constants';
import {
  Subscribable,
  ActorLogic,
  EventObject,
  Subscription,
  AnyActorSystem,
  ActorRefFrom
} from '../types';

export interface ObservableInternalState<T, TInput = unknown> {
  subscription: Subscription | undefined;
  status: 'active' | 'done' | 'error' | 'canceled';
  data: T | undefined;
  input: TInput | undefined;
}

export type ObservablePersistedState<T, TInput = unknown> = Omit<
  ObservableInternalState<T, TInput>,
  'subscription'
>;

export type ObservableActorLogic<T, TInput> = ActorLogic<
  { type: string; [k: string]: unknown },
  T | undefined,
  ObservableInternalState<T, TInput>,
  ObservablePersistedState<T, TInput>,
  AnyActorSystem,
  TInput
>;

export type ObservableActorRef<T> = ActorRefFrom<ObservableActorLogic<T, any>>;

export function fromObservable<T, TInput>(
  observableCreator: ({
    input,
    system
  }: {
    input: TInput;
    system: AnyActorSystem;
    self: ObservableActorRef<T>;
  }) => Subscribable<T>
): ObservableActorLogic<T, TInput> {
  const nextEventType = '$$xstate.next';
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';

  // TODO: add event types
  const logic: ObservableActorLogic<T, TInput> = {
    name: 'observable',
    config: observableCreator,
    transition: (state, event, { self, id, defer, system }) => {
      if (state.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case nextEventType:
          // match the exact timing of events sent by machines
          // send actions are not executed immediately
          defer(() => {
            system.sendTo(
              self._parent,
              {
                type: `xstate.snapshot.${id}`,
                data: event.data
              },
              self
            );
          });
          return {
            ...state,
            data: (event as any).data
          };
        case errorEventType:
          return {
            ...state,
            status: 'error',
            input: undefined,
            data: (event as any).data, // TODO: if we keep this as `data` we should reflect this in the type
            subscription: undefined
          };
        case completeEventType:
          return {
            ...state,
            status: 'done',
            input: undefined,
            subscription: undefined
          };
        case XSTATE_STOP:
          state.subscription!.unsubscribe();
          return {
            ...state,
            status: 'canceled',
            input: undefined,
            subscription: undefined
          };
        default:
          return state;
      }
    },
    getInitialState: (_, input) => {
      return {
        subscription: undefined,
        status: 'active',
        data: undefined,
        input
      };
    },
    start: (state, { self, system }) => {
      if (state.status === 'done') {
        // Do not restart a completed observable
        return;
      }
      state.subscription = observableCreator({
        input: state.input!,
        system,
        self
      }).subscribe({
        next: (value) => {
          system.sendTo(self, { type: nextEventType, data: value }, self);
        },
        error: (err) => {
          system.sendTo(self, { type: errorEventType, data: err }, self);
        },
        complete: () => {
          system.sendTo(self, { type: completeEventType }, self);
        }
      });
    },
    getSnapshot: (state) => state.data,
    getPersistedState: ({ status, data, input }) => ({
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

  return logic;
}

/**
 * Creates event observable logic that listens to an observable
 * that delivers event objects.
 *
 *
 * @param lazyObservable A function that creates an observable
 * @returns Event observable logic
 */

export function fromEventObservable<T extends EventObject, TInput>(
  lazyObservable: ({
    input,
    system
  }: {
    input: TInput;
    system: AnyActorSystem;
    self: ObservableActorRef<T>;
  }) => Subscribable<T>
): ObservableActorLogic<T, TInput> {
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';

  // TODO: event types
  const logic: ObservableActorLogic<T, TInput> = {
    name: 'eventObservable',
    config: lazyObservable,
    transition: (state, event) => {
      if (state.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case errorEventType:
          return {
            ...state,
            status: 'error',
            input: undefined,
            data: (event as any).data, // TODO: if we keep this as `data` we should reflect this in the type
            subscription: undefined
          };
        case completeEventType:
          return {
            ...state,
            status: 'done',
            input: undefined,
            subscription: undefined
          };
        case XSTATE_STOP:
          state.subscription!.unsubscribe();
          return {
            ...state,
            status: 'canceled',
            input: undefined,
            subscription: undefined
          };
        default:
          return state;
      }
    },
    getInitialState: (_, input) => {
      return {
        subscription: undefined,
        status: 'active',
        data: undefined,
        input
      };
    },
    start: (state, { self, system }) => {
      if (state.status === 'done') {
        // Do not restart a completed observable
        return;
      }

      state.subscription = lazyObservable({
        input: state.input!,
        system,
        self
      }).subscribe({
        next: (value) => {
          system.sendTo(self._parent, value, self);
        },
        error: (err) => {
          system.sendTo(self, { type: errorEventType, data: err }, self);
        },
        complete: () => {
          system.sendTo(self, { type: completeEventType }, self);
        }
      });
    },
    getSnapshot: (_) => undefined,
    getPersistedState: ({ status, data, input }) => ({
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

  return logic;
}
