import type {
  InvokeCallback,
  Subscribable,
  Subscription,
  InterpreterOptions,
  Lazy,
  Sender,
  Receiver,
  Behavior,
  ActorContext,
  EventObject,
  ActorRef,
  AnyStateMachine,
  BaseActorRef
} from './types';
import { toSCXMLEvent, isPromiseLike, isSCXMLEvent, isFunction } from './utils';
import { symbolObservable } from './symbolObservable';
import { doneInvoke, error } from './actions';

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
): Behavior<TEvent, TState> {
  return {
    transition: (state, event, actorCtx) => {
      // @ts-ignore TODO
      const resolvedEvent = isSCXMLEvent(event) ? event.data : event;
      // @ts-ignore TODO
      return transition(state, resolvedEvent, actorCtx);
    },
    initialState,
    getSnapshot: (state) => state
  };
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

export function fromCallback<TEvent extends EventObject>(
  invokeCallback: InvokeCallback
): Behavior<TEvent, undefined> {
  const behavior: Behavior<
    TEvent,
    undefined,
    {
      canceled: boolean;
      receivers: Set<(e: EventObject) => void>;
      dispose: void | (() => void) | Promise<any>;
    }
  > = {
    transition: (state, event, { self, name }) => {
      const _event = toSCXMLEvent(event);
      const { _parent: parent } = self;

      if (_event.name === startSignalType) {
        const sender: Sender<TEvent> = (e) => {
          if (state.canceled) {
            return state;
          }

          parent?.send(toSCXMLEvent(e, { origin: self }));
        };

        const receiver: Receiver<TEvent> = (newListener) => {
          state.receivers.add(newListener);
        };

        state.dispose = invokeCallback(sender, receiver);

        if (isPromiseLike(state.dispose)) {
          state.dispose.then(
            (resolved) => {
              self._parent?.send(
                toSCXMLEvent(doneInvoke(name, resolved), {
                  origin: self
                })
              );

              state.canceled = true;
            },
            (errorData) => {
              const errorEvent = error(name, errorData);

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
      } else if (_event.name === stopSignalType) {
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
    initialState: {
      canceled: false,
      receivers: new Set<(e: EventObject) => void>(),
      dispose: undefined
    },
    getSnapshot: () => undefined
  };

  return behavior;
}

export function fromPromise<T>(
  lazyPromise: Lazy<PromiseLike<T>>
): Behavior<{ type: string }, T | undefined> {
  const resolveEventType = '$$xstate.resolve';
  const rejectEventType = '$$xstate.reject';

  // TODO: add event types
  const behavior: Behavior<
    any,
    T | undefined,
    { canceled: boolean; data: T | undefined }
  > = {
    transition: (state, event, { self, name }) => {
      const _event = toSCXMLEvent(event);
      if (state.canceled) {
        return state;
      }

      switch (_event.name) {
        case startSignalType:
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
        case resolveEventType:
          self._parent?.send(
            toSCXMLEvent(doneInvoke(name, _event.data.data) as any, {
              origin: self
            })
          );
          return { ...state, data: event.data };
        case rejectEventType:
          const errorEvent = error(name, _event.data.data);

          self._parent?.send(
            toSCXMLEvent(errorEvent, {
              origin: self
            })
          );
          return { ...state, data: event.data };
        case stopSignalType:
          return { ...state, canceled: true };
        default:
          return state;
      }
    },
    initialState: {
      canceled: false,
      data: undefined
    },
    getSnapshot: (state) => state.data
  };

  return behavior;
}

export function fromObservable<T, TEvent extends EventObject>(
  lazyObservable: Lazy<Subscribable<T>>
): Behavior<TEvent, T | undefined> {
  let subscription: Subscription | undefined;
  let observable: Subscribable<T> | undefined;
  let canceled = false;
  const nextEventType = '$$xstate.next';
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';

  // TODO: add event types
  const behavior: Behavior<
    any,
    T | undefined,
    {
      subscription: Subscription | undefined;
      observable: Subscribable<T> | undefined;
      canceled: boolean;
      data: T | undefined;
    }
  > = {
    transition: (state, event, { self, name }) => {
      const _event = toSCXMLEvent(event);
      if (canceled) {
        return state;
      }

      switch (_event.name) {
        case startSignalType:
          observable = lazyObservable();
          subscription = observable.subscribe({
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
        case nextEventType:
          self._parent?.send(
            toSCXMLEvent(
              {
                type: `xstate.snapshot.${name}`,
                data: _event.data.data
              },
              { origin: self }
            )
          );
          return { ...state, data: event.data };
        case errorEventType:
          const errorEvent = error(name, _event.data.data);
          self._parent?.send(
            toSCXMLEvent(errorEvent, {
              origin: self
            })
          );
          return state;
        case completeEventType:
          self._parent?.send(
            toSCXMLEvent(doneInvoke(name), {
              origin: self
            })
          );
          return state;
        case stopSignalType:
          canceled = true;
          subscription?.unsubscribe();
          return state;
        default:
          return state;
      }
    },
    initialState: {
      subscription: undefined as Subscription | undefined,
      observable: undefined as Subscribable<T> | undefined,
      canceled: false,
      data: undefined
    },
    getSnapshot: (state) => state.data
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
  const nextEventType = '$$xstate.next';
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';

  // TODO: event types
  const behavior: Behavior<
    any,
    T | undefined,
    {
      subscription: Subscription | undefined;
      observable: Subscribable<T> | undefined;
      canceled: boolean;
      data: T | undefined;
    }
  > = {
    transition: (state, event, { self, name }) => {
      const _event = toSCXMLEvent(event);
      if (state.canceled) {
        return state;
      }

      switch (_event.name) {
        case startSignalType:
          state.observable = lazyObservable();
          state.subscription = state.observable.subscribe({
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
        case nextEventType:
          return { ...state, data: _event.data };
        case errorEventType:
          const errorEvent = error(name, _event.data.data);
          self._parent?.send(
            toSCXMLEvent(errorEvent, {
              origin: self
            })
          );
          return state;
        case completeEventType:
          self._parent?.send(
            toSCXMLEvent(doneInvoke(name), {
              origin: self
            })
          );
          return state;
        case stopSignalType:
          state.canceled = true;
          state.subscription?.unsubscribe();
          return state;
        default:
          return state;
      }
    },
    initialState: {
      subscription: undefined as Subscription | undefined,
      observable: undefined as Subscribable<T> | undefined,
      canceled: false,
      data: undefined
    },
    getSnapshot: (_) => undefined
  };

  return behavior;
}

export function fromMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  _options: Partial<InterpreterOptions> = {}
): TMachine {
  return machine;
}

export function isActorRef(item: any): item is ActorRef<any> {
  return !!item && typeof item === 'object' && typeof item.send === 'function';
}

// TODO: refactor the return type, this could be written in a better way
// but it's best to avoid unneccessary breaking changes now
export function toActorRef<
  TEvent extends EventObject,
  TSnapshot = any,
  TActorRefLike extends BaseActorRef<TEvent> = BaseActorRef<TEvent>
>(
  actorRefLike: TActorRefLike
): ActorRef<TEvent, TSnapshot> & Omit<TActorRefLike, keyof ActorRef<any, any>> {
  return {
    subscribe: () => ({ unsubscribe: () => void 0 }),
    name: 'anonymous',
    getSnapshot: () => undefined,
    [symbolObservable]: function () {
      return this;
    },
    ...actorRefLike
  };
}
