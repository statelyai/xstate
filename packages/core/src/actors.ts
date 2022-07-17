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
    initialState
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

function isSignal(
  eventType: string | Symbol
): eventType is LifecycleSignalType {
  return eventType === startSignalType || eventType === stopSignalType;
}

export function fromCallback<TEvent extends EventObject>(
  invokeCallback: InvokeCallback
): Behavior<TEvent, undefined> {
  let canceled = false;
  const receivers = new Set<(e: EventObject) => void>();
  let dispose;

  const behavior: Behavior<TEvent, undefined> = {
    transition: (_, event, { self, name, _event }) => {
      const { _parent: parent } = self;

      if (_event.name === startSignalType) {
        const sender: Sender<TEvent> = (e) => {
          if (canceled) {
            return;
          }

          parent?.send(toSCXMLEvent(e, { origin: self }));
        };

        const receiver: Receiver<TEvent> = (newListener) => {
          receivers.add(newListener);
        };

        dispose = invokeCallback(sender, receiver);

        if (isPromiseLike(dispose)) {
          dispose.then(
            (resolved) => {
              self._parent?.send(
                toSCXMLEvent(doneInvoke(name, resolved), {
                  origin: self
                })
              );

              canceled = true;
            },
            (errorData) => {
              const errorEvent = error(name, errorData);

              self._parent?.send(
                toSCXMLEvent(errorEvent, {
                  origin: self
                })
              );

              canceled = true;
            }
          );
        }
        return undefined;
      } else if (_event.name === stopSignalType) {
        canceled = true;

        if (isFunction(dispose)) {
          dispose();
        }
        return undefined;
      }

      if (isSignal(_event.name)) {
        // TODO: unrecognized signal
        return undefined;
      }

      const plainEvent = isSCXMLEvent(event) ? event.data : event;
      if (!isSignal(plainEvent.type)) {
        receivers.forEach((receiver) => receiver(plainEvent as EventObject));
      }

      return undefined;
    },
    initialState: undefined
  };

  return behavior;
}

export function fromPromise<T>(
  lazyPromise: Lazy<PromiseLike<T>>
): Behavior<{ type: string }, T | undefined> {
  let canceled = false;
  const resolveEventType = '$$xstate.resolve';
  const rejectEventType = '$$xstate.reject';

  // TODO: add event types
  const behavior: Behavior<any, T | undefined> = {
    transition: (state, event, { self, name }) => {
      const _event = toSCXMLEvent(event);
      if (canceled) {
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
          return undefined;
        case resolveEventType:
          self._parent?.send(
            toSCXMLEvent(doneInvoke(name, _event.data.data) as any, {
              origin: self
            })
          );
          return event.data;
        case rejectEventType:
          const errorEvent = error(name, _event.data.data);

          self._parent?.send(
            toSCXMLEvent(errorEvent, {
              origin: self
            })
          );
          return event.data;
        case stopSignalType:
          canceled = true;
          return undefined;
        default:
          return undefined;
      }
    },
    initialState: undefined
  };

  return behavior;
}

export function fromObservable<T, TEvent extends EventObject>(
  lazyObservable: Lazy<Subscribable<T>>
): Behavior<TEvent, T | undefined> {
  let subscription: Subscription | undefined;
  let observable: Subscribable<T> | undefined;
  const nextEventType = '$$xstate.next';
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';
  let canceled = false;

  // TODO: add event types
  const behavior: Behavior<any, T | undefined> = {
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
          return event.data;
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
    initialState: undefined
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
  let subscription: Subscription | undefined;
  let observable: Subscribable<T> | undefined;
  const nextEventType = '$$xstate.next';
  const errorEventType = '$$xstate.error';
  const completeEventType = '$$xstate.complete';
  let canceled = false;

  // TODO: event types
  const behavior: Behavior<any, T | undefined> = {
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
          return _event.data;
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
    initialState: undefined
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
