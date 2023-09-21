import { XSTATE_STOP } from '../constants';
import {
  Subscribable,
  ActorLogic,
  EventObject,
  Subscription,
  AnyActorSystem,
  ActorRefFrom,
  ActorInternalState,
  TODO
} from '../types';

export interface ObservableInternalState<TSnapshot, TInput = unknown>
  extends ActorInternalState<TSnapshot, TSnapshot> {
  subscription: Subscription | undefined;
  input: TInput | undefined;
}

export type ObservablePersistedState<TSnapshot, TInput = unknown> = Omit<
  ObservableInternalState<TSnapshot, TInput>,
  'subscription'
>;

export type ObservableActorLogic<TSnapshot, TInput> = ActorLogic<
  TSnapshot | undefined,
  { type: string; [k: string]: unknown },
  TInput,
  unknown,
  ObservableInternalState<TSnapshot | undefined, TInput>,
  ObservablePersistedState<TSnapshot | undefined, TInput>,
  AnyActorSystem
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

  return {
    config: observableCreator,
    transition: (state, event, { self, id, defer }) => {
      if (state.status.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case nextEventType:
          // match the exact timing of events sent by machines
          // send actions are not executed immediately
          defer(() => {
            self._parent?.send({
              type: `xstate.snapshot.${id}`,
              data: event.data
            });
          });
          return {
            ...state,
            snapshot: (event as any).data
          };
        case errorEventType:
          return {
            ...state,
            status: {
              status: 'error',
              error: (event as any).data
            },
            input: undefined,
            subscription: undefined
          };
        case completeEventType:
          return {
            ...state,
            status: {
              status: 'done',
              output: state.snapshot
            },
            input: undefined,
            subscription: undefined
          };
        case XSTATE_STOP:
          state.subscription!.unsubscribe();
          return {
            ...state,
            status: {
              status: 'stopped'
            },
            input: undefined,
            subscription: undefined
          };
        default:
          return state;
      }
    },
    getInitialState: (_, input) => {
      return {
        snapshot: undefined,
        status: { status: 'active' },
        subscription: undefined,
        input
      };
    },
    start: (state, { self, system }) => {
      if (state.status.status === 'done') {
        // Do not restart a completed observable
        return;
      }
      state.subscription = observableCreator({
        input: state.input!,
        system,
        self
      }).subscribe({
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
    getPersistedState: (state) => state,
    restoreState: (state) => ({
      ...state,
      subscription: undefined
    })
  };
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
  return {
    config: lazyObservable,
    transition: (state, event) => {
      if (state.status.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case errorEventType:
          return {
            ...state,
            status: {
              status: 'error',
              error: (event as any).data
            },
            input: undefined,
            subscription: undefined
          };
        case completeEventType:
          return {
            ...state,
            status: {
              status: 'done',
              output: undefined
            },
            input: undefined,
            subscription: undefined
          };
        case XSTATE_STOP:
          state.subscription!.unsubscribe();
          return {
            ...state,
            status: {
              status: 'stopped'
            },
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
        snapshot: undefined,
        status: { status: 'active' },
        input
      };
    },
    start: (state, { self, system }) => {
      if (state.status.status === 'done') {
        // Do not restart a completed observable
        return;
      }

      state.subscription = lazyObservable({
        input: state.input!,
        system,
        self
      }).subscribe({
        next: (value) => {
          self._parent?.send(value);
        },
        error: (err) => {
          self.send({ type: errorEventType, data: err });
        },
        complete: () => {
          self.send({ type: completeEventType });
        }
      });
    },
    getPersistedState: (state) => state,
    restoreState: (state) =>
      ({
        ...state,
        subscription: undefined
      } as TODO)
  };
}
