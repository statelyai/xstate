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
  Observer,
  ActorRef,
  AnyStateMachine,
  BaseActorRef,
  EventFrom,
  InterpreterFrom,
  StateFrom
} from './types';
import { AreAllImplementationsAssumedToBeProvided } from './typegenTypes';
import {
  toSCXMLEvent,
  isPromiseLike,
  isSCXMLEvent,
  isFunction,
  toObserver,
  symbolObservable
} from './utils';
import { actionTypes, doneInvoke, error } from './actions';
import { interpret } from './interpreter';
import { Mailbox } from './Mailbox';

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

export const startSignalType = Symbol.for('xstate.invoke');
export const stopSignalType = Symbol.for('xstate.stop');
export const startSignal: StartSignal = { type: startSignalType };
export const stopSignal: StopSignal = { type: stopSignalType };

export interface StartSignal {
  type: typeof startSignalType;
}

export interface StopSignal {
  type: typeof stopSignalType;
}

export type LifecycleSignal = StartSignal | StopSignal;

/**
 * An object that expresses the behavior of an actor in reaction to received events,
 * as well as an optionally emitted stream of values.
 *
 * @template TReceived The received event
 * @template TSnapshot The emitted value
 */

function isSignal(
  event: EventObject | LifecycleSignal
): event is LifecycleSignal {
  return typeof event.type === 'symbol';
}

export function fromCallback<TEvent extends EventObject>(
  invokeCallback: InvokeCallback
): Behavior<TEvent, undefined> {
  let canceled = false;
  const receivers = new Set<(e: EventObject) => void>();
  let dispose;

  const behavior: Behavior<TEvent, undefined> = {
    transition: (_, event, { self, observers }) => {
      const { _parent: parent } = self;

      if (event.type === startSignalType) {
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
              observers.forEach((o) => o.next?.(resolved));
              observers.forEach((o) => o.complete?.());

              canceled = true;
            },
            (errorData) => {
              observers.forEach((o) => o.error?.(errorData));

              canceled = true;
            }
          );
        }
        return undefined;
      } else if (event.type === stopSignalType) {
        canceled = true;

        if (isFunction(dispose)) {
          dispose();
        }
        return undefined;
      }

      if (isSignal(event)) {
        // TODO: unrecognized signal
        return undefined;
      }

      const plainEvent = isSCXMLEvent(event) ? event.data : event;
      receivers.forEach((receiver) => receiver(plainEvent));

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
  const resolveEventType = Symbol('resolve');
  const rejectEventType = Symbol('reject');

  // TODO: add event types
  const behavior: Behavior<any, T | undefined> = {
    transition: (state, event, { self, name }) => {
      if (canceled) {
        return state;
      }

      switch (event.type) {
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
            toSCXMLEvent(doneInvoke(name, event.data) as any, {
              origin: self
            })
          );
          return event.data;
        case rejectEventType:
          const errorEvent = error(name, event.data);

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
  const nextEventType = Symbol('next');
  const errorEventType = Symbol('error');
  const completeEventType = Symbol('complete');
  let canceled = false;

  // TODO: add event types
  const behavior: Behavior<any, T | undefined> = {
    transition: (state, event, { self, name }) => {
      if (canceled) {
        return state;
      }

      switch (event.type) {
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
                data: event.data
              },
              { origin: self }
            )
          );
          return event.data;
        case errorEventType:
          const errorEvent = error(name, event.data);
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
  const nextEventType = Symbol('next');
  const errorEventType = Symbol('error');
  const completeEventType = Symbol('complete');
  let canceled = false;

  // TODO: event types
  const behavior: Behavior<any, T | undefined> = {
    transition: (state, event, { self, name }) => {
      if (canceled) {
        return state;
      }

      switch (event.type) {
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
          return event.data;
        case errorEventType:
          const errorEvent = error(name, event.data);
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
  machine: AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends true
    ? TMachine
    : 'Some implementations missing',
  options?: Partial<InterpreterOptions>
): Behavior<EventFrom<TMachine>, StateFrom<TMachine>> {
  const castedMachine = machine as TMachine;
  let service: InterpreterFrom<TMachine> | undefined;
  let subscription: Subscription;
  let initialState: StateFrom<TMachine>;

  const behavior: Behavior<EventFrom<TMachine>, StateFrom<TMachine>> = {
    transition: (state, event, actorContext) => {
      const { _parent: parent } = actorContext.self;

      if (event.type === startSignalType) {
        service = interpret(castedMachine as AnyStateMachine, {
          ...options,
          parent,
          id: actorContext.name
        }) as InterpreterFrom<TMachine>;
        service.onDone((doneEvent) => {
          parent?.send(
            toSCXMLEvent(doneEvent, {
              origin: actorContext.self
            })
          );
        });

        if (options?.sync) {
          subscription = service.subscribe((snapshotState) => {
            parent?.send(
              toSCXMLEvent(
                {
                  type: actionTypes.update,
                  state: snapshotState
                },
                { origin: actorContext.self }
              )
            );
          });
        }
        service.start();
        return state;
      }

      if (event.type === stopSignalType) {
        service?.stop();
        subscription?.unsubscribe(); // TODO: might not be necessary
        return state;
      }

      const _event = actorContext._event;

      if (isSignal(_event)) {
        // TODO: unrecognized signal
        return state;
      }

      service?.send(_event);
      return state;
    },
    get initialState() {
      // TODO: recheck if this caching is needed, write a test for its importance or remove the caching
      if (initialState) {
        return initialState;
      }
      initialState = castedMachine.getInitialState();
      return initialState;
    }
  };

  return behavior;
}

interface CreateActorRefOptions {
  id?: string;
  parent?: ActorRef<any>;
}

// TODO: delete this (should use ObservableActorRef instead)
export function createActorRef<TEvent extends EventObject, TSnapshot>(
  behavior: Behavior<TEvent, TSnapshot>,
  options: CreateActorRefOptions = {}
): ActorRef<TEvent, TSnapshot> {
  let state = behavior.initialState;
  const observers = new Set<Observer<TSnapshot>>();
  const mailbox = new Mailbox<TEvent>((event) => {
    state = behavior.transition(state, event, actorCtx);
    observers.forEach((observer) => observer.next?.(state));
  });

  const actor: ActorRef<TEvent, TSnapshot> = {
    name: options.id || 'anonymous',
    send: (event: TEvent) => {
      mailbox.enqueue(event);
    },
    getSnapshot: () => state,
    [symbolObservable]: function () {
      return this;
    },
    subscribe: (next, handleError?, complete?) => {
      const observer = toObserver(next, handleError, complete);
      observers.add(observer);
      observer.next?.(state);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
    },
    start() {
      mailbox.start();
    },
    stop() {
      mailbox.clear();
    }
  };

  const actorCtx: ActorContext<TEvent, TSnapshot> = {
    self: actor,
    name: options.id || 'anonymous',
    observers,
    _event: null as any
  };

  return actor;
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
