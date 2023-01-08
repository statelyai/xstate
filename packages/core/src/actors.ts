import type {
  InvokeCallback,
  Subscribable,
  Subscription,
  Lazy,
  Receiver,
  Behavior,
  ActorContext,
  EventObject,
  ActorRef,
  BaseActorRef,
  AnyEventObject
} from './types';
import { toSCXMLEvent, isPromiseLike, isSCXMLEvent, isFunction } from './utils';
import { doneInvoke, error } from './actions';
import { symbolObservable } from './symbolObservable';
import { ActorStatus } from './interpreter';

/**
 * Returns an actor behavior from a reducer and its initial state.
 *
 * @param transition The pure reducer that returns the next state given the current state and event.
 * @param initialState The initial state of the reducer.
 * @returns An actor behavior
 */
export function fromReducer<TState, TEvent extends EventObject>(
  transition: (
    state: TState,
    event: TEvent,
    actorContext: ActorContext<TEvent, TState>
  ) => TState,
  initialState: TState
): WithRequired<Behavior<TEvent, TState, TState>, 'at'> {
  const behavior = {
    transition: (state, event, actorCtx) => {
      // @ts-ignore TODO
      const resolvedEvent = isSCXMLEvent(event) ? event.data : event;
      // @ts-ignore TODO
      return transition(state, resolvedEvent, actorCtx);
    },
    getInitialState: () => initialState,
    getSnapshot: (state) => state,
    getPersisted: (state) => state,
    restoreState: (state) => state,
    at: (state) => ({
      ...behavior,
      getInitialState: () => state
    })
  };

  return behavior;
}

export const startSignalType = 'xstate.init';
export const stopSignalType = 'xstate.stop';
export const startSignal: StartSignal = { type: 'xstate.init' };
export const stopSignal: StopSignal = { type: 'xstate.stop' };

export interface StartSignal {
  type: 'xstate.init';
}

export interface StopSignal {
  type: 'xstate.stop';
}

export type LifecycleSignal = StartSignal | StopSignal;
export type LifecycleSignalType =
  | typeof startSignalType
  | typeof stopSignalType;

/**
 * An object that expresses the behavior of an actor in reaction to received events,
 * as well as an optionally emitted stream of values.
 *
 * @template TReceived The received event
 * @template TSnapshot The emitted value
 */

function isSignal(eventType: string): eventType is LifecycleSignalType {
  return eventType === startSignalType || eventType === stopSignalType;
}

interface CallbackInternalState {
  canceled: boolean;
  receivers: Set<(e: EventObject) => void>;
  dispose: void | (() => void) | Promise<any>;
}

export function fromCallback<TEvent extends EventObject>(
  invokeCallback: InvokeCallback
): Behavior<TEvent, undefined> {
  const behavior: Behavior<TEvent, undefined, CallbackInternalState> = {
    start: (state, actorCtx) => {
      actorCtx.self.send({ type: startSignalType } as TEvent);

      return behavior.getInitialState(actorCtx);
    },
    transition: (state, event, { self, id }) => {
      const _event = toSCXMLEvent(event);

      if (_event.name === startSignalType) {
        const sender = (eventForParent: AnyEventObject) => {
          if (state.canceled) {
            return state;
          }

          self._parent?.send(toSCXMLEvent(eventForParent, { origin: self }));
        };

        const receiver: Receiver<TEvent> = (newListener) => {
          state.receivers.add(newListener);
        };

        state.dispose = invokeCallback(sender, receiver);

        if (isPromiseLike(state.dispose)) {
          state.dispose.then(
            (resolved) => {
              self._parent?.send(
                toSCXMLEvent(doneInvoke(id, resolved), {
                  origin: self
                })
              );

              state.canceled = true;
            },
            (errorData) => {
              const errorEvent = error(id, errorData);

              self._parent?.send(
                toSCXMLEvent(errorEvent, {
                  origin: self
                })
              );

              state.canceled = true;
            }
          );
        }
        return state;
      }

      if (_event.name === stopSignalType) {
        state.canceled = true;

        if (isFunction(state.dispose)) {
          state.dispose();
        }
        return state;
      }

      if (isSignal(_event.name)) {
        // TODO: unrecognized signal
        return state;
      }

      const plainEvent = isSCXMLEvent(event) ? event.data : event;
      if (!isSignal(plainEvent.type)) {
        state.receivers.forEach((receiver) =>
          receiver(plainEvent as EventObject)
        );
      }

      return state;
    },
    getInitialState: () => {
      return {
        canceled: false,
        receivers: new Set(),
        dispose: undefined
      };
    },
    getSnapshot: () => undefined
  };

  return behavior;
}

interface PromiseInternalState<T> {
  status: 'active' | 'error' | 'done';
  canceled: boolean;
  data: T | undefined;
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export function fromPromise<T>(
  lazyPromise: Lazy<PromiseLike<T>>
): WithRequired<
  Behavior<{ type: string }, T | undefined, PromiseInternalState<T>>,
  'at'
> {
  const resolveEventType = '$$xstate.resolve';
  const rejectEventType = '$$xstate.reject';

  // TODO: add event types
  const behavior: WithRequired<
    Behavior<{ type: string }, T | undefined, PromiseInternalState<T>>,
    'at'
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
    at: (persistedState) => {
      return {
        ...behavior,
        getInitialState: () => persistedState
      };
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
    getPersisted: (state) => state,
    restoreState: (state) => state
  };

  return behavior;
}

interface ObservableInternalState<T> {
  subscription: Subscription | undefined;
  canceled: boolean;
  status: 'active' | 'done' | 'error';
  data: T | undefined;
}

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

export function isActorRef(item: any): item is ActorRef<any> {
  return !!item && typeof item === 'object' && typeof item.send === 'function';
}

// TODO: refactor the return type, this could be written in a better way
// but it's best to avoid unneccessary breaking changes now
// @deprecated use `interpret(behavior)` instead
export function toActorRef<
  TEvent extends EventObject,
  TSnapshot = any,
  TActorRefLike extends BaseActorRef<TEvent> = BaseActorRef<TEvent>
>(
  actorRefLike: TActorRefLike
): ActorRef<TEvent, TSnapshot> & Omit<TActorRefLike, keyof ActorRef<any, any>> {
  return {
    subscribe: () => ({ unsubscribe: () => void 0 }),
    id: 'anonymous',
    getSnapshot: () => undefined,
    [symbolObservable]: function () {
      return this;
    },
    status: ActorStatus.Running,
    ...actorRefLike
  };
}
