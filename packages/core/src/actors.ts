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
  TODO,
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
import { error, actionTypes } from './actions';
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
 * @template TEmitted The emitted value
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
  const observers: Set<Observer<TODO>> = new Set();
  let dispose;

  const sendNext = (event: TODO) => {
    observers.forEach((o) => o.next?.(event));
  };

  const sendError = (event: TODO) => {
    observers.forEach((o) => o.error?.(event));
  };

  const sendComplete = () => {
    observers.forEach((o) => o.complete?.());
  };

  const behavior: Behavior<TEvent, undefined> = {
    transition: (_, event, actorContext) => {
      const { _parent: parent } = actorContext.self;

      if (event.type === startSignalType) {
        const sender: Sender<TEvent> = (e) => {
          if (canceled) {
            return;
          }

          parent?.send(toSCXMLEvent(e, { origin: actorContext.self }));
        };

        const receiver: Receiver<TEvent> = (newListener) => {
          receivers.add(newListener);
        };

        dispose = invokeCallback(sender, receiver);

        if (isPromiseLike(dispose)) {
          dispose.then(
            (resolved) => {
              sendNext(resolved);
              sendComplete();
              canceled = true;
            },
            (errorData) => {
              const errorEvent = error(actorContext.name, errorData);
              sendError(
                toSCXMLEvent(errorEvent, { origin: actorContext.self })
              );
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
    subscribe: (observer) => {
      observers.add(observer);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
    },
    initialState: undefined
  };

  return behavior;
}

export function fromPromise<T, TEvent extends EventObject>(
  lazyPromise: Lazy<PromiseLike<T>>
): Behavior<any, T | undefined> {
  let canceled = false;
  const observers: Set<Observer<T>> = new Set();

  const behavior: Behavior<TEvent, T | undefined> = {
    transition: (_, event, actorContext) => {
      switch (event.type) {
        case startSignalType:
          const resolvedPromise = Promise.resolve(lazyPromise());

          resolvedPromise.then(
            (response) => {
              if (!canceled) {
                observers.forEach((observer) => {
                  observer.next?.(response);
                  if (observers.has(observer)) observer.complete?.();
                });
              }
            },
            (errorData) => {
              if (!canceled) {
                const errorEvent = error(actorContext.name, errorData);

                observers.forEach((observer) => {
                  observer.error?.(
                    toSCXMLEvent(errorEvent, { origin: actorContext.self })
                  );
                });
              }
            }
          );
          return undefined;
        case stopSignalType:
          canceled = true;
          observers.clear();
          return undefined;
        default:
          return undefined;
      }
    },
    subscribe: (observer) => {
      observers.add(observer);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
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
  const observers: Set<Observer<TODO>> = new Set();
  const sendNext = (event: TODO) => {
    observers.forEach((o) => o.next?.(event));
  };

  const sendError = (event: TODO) => {
    observers.forEach((o) => o.error?.(event));
  };
  const sendComplete = () => {
    observers.forEach((o) => o.complete?.());
  };

  const behavior: Behavior<TEvent, T | undefined> = {
    transition: (_, event, actorContext) => {
      if (event.type === startSignalType) {
        observable = lazyObservable();
        subscription = observable.subscribe({
          next: (value) => {
            sendNext(value);
          },
          error: (err) => {
            sendError(
              toSCXMLEvent(error(actorContext.name, err) as any, {
                origin: actorContext.self
              })
            );
          },
          complete: () => {
            sendComplete();
          }
        });
      } else if (event.type === stopSignalType) {
        subscription && subscription.unsubscribe();
      }

      return undefined;
    },
    subscribe: (observer) => {
      observers.add(observer);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
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
          subscription = service.subscribe((emittedState) => {
            parent?.send(
              toSCXMLEvent(
                {
                  type: actionTypes.update,
                  state: emittedState
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
    subscribe: (observer) => {
      return service?.subscribe(observer);
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

export function createActorRef<TEvent extends EventObject, TEmitted>(
  behavior: Behavior<TEvent, TEmitted>,
  options: CreateActorRefOptions = {}
): ActorRef<TEvent, TEmitted> {
  let state = behavior.initialState;
  const observers = new Set<Observer<TEmitted>>();
  const mailbox = new Mailbox<TEvent>((event) => {
    state = behavior.transition(state, event, actorCtx);
    observers.forEach((observer) => observer.next?.(state));
  });

  const actor: ActorRef<TEvent, TEmitted> = {
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

  const actorCtx: ActorContext<TEvent, TEmitted> = {
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
  TEmitted = any,
  TActorRefLike extends BaseActorRef<TEvent> = BaseActorRef<TEvent>
>(
  actorRefLike: TActorRefLike
): ActorRef<TEvent, TEmitted> & Omit<TActorRefLike, keyof ActorRef<any, any>> {
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
