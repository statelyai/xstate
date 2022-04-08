import {
  InvokeCallback,
  Subscribable,
  Subscription,
  InterpreterOptions,
  Spawnable,
  Lazy,
  Sender,
  Receiver,
  Behavior,
  ActorContext,
  ActorRef,
  EventObject,
  Observer,
  TODO
} from './types';
import {
  toSCXMLEvent,
  isPromiseLike,
  isObservable,
  isStateMachine,
  isSCXMLEvent,
  isFunction
} from './utils';
import { doneInvoke, error, actionTypes } from './actions';
import { StateMachine } from './StateMachine';
import { interpret } from './interpreter';
import { State } from './State';
import { toActorRef } from './actor';
import { toObserver } from './utils';
import { Mailbox } from './Mailbox';
import { AnyStateMachine, EventFrom, InterpreterFrom, StateFrom } from '.';

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

type PromiseEvents<T> =
  | { type: 'fulfill'; data: T }
  | { type: 'reject'; error: unknown };

type PromiseState<T> =
  | {
      status: 'pending';
      data: undefined;
      error: undefined;
    }
  | {
      status: 'fulfilled';
      data: T;
      error: undefined;
    }
  | {
      status: 'rejected';
      data: undefined;
      error: any;
    };

export function fromPromise<T>(
  promiseFn: () => Promise<T>
): Behavior<PromiseEvents<T>, PromiseState<T>> {
  const initialState: PromiseState<T> = {
    error: undefined,
    data: undefined,
    status: 'pending'
  };

  return {
    transition: (state, event, { observers }) => {
      switch (event.type) {
        case 'fulfill':
          return {
            error: undefined,
            data: event.data,
            status: 'fulfilled'
          };
        case 'reject':
          observers.forEach((observer) => {
            observer.error?.(event.error);
          });
          return {
            error: event.error,
            data: undefined,
            status: 'rejected'
          };
        default:
          return state;
      }
    },
    initialState,
    start: ({ self }) => {
      promiseFn().then(
        (data) => {
          self.send({ type: 'fulfill', data });
        },
        (reason) => {
          self.send({ type: 'reject', error: reason });
        }
      );

      return initialState;
    }
  };
}

interface SpawnBehaviorOptions {
  id?: string;
  parent?: ActorRef<any>;
}

export function spawnBehavior<TEvent extends EventObject, TEmitted>(
  behavior: Behavior<TEvent, TEmitted>,
  options: SpawnBehaviorOptions = {}
): ActorRef<TEvent, TEmitted> {
  let state = behavior.initialState;
  const observers = new Set<Observer<TEmitted>>();
  const mailbox = new Mailbox<TEvent>((event) => {
    state = behavior.transition(state, event, actorCtx);
    observers.forEach((observer) => observer.next?.(state));
  });

  const actor = toActorRef({
    id: options.id,
    send: (event: TEvent) => {
      mailbox.enqueue(event);
    },
    getSnapshot: () => state,
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
  });

  const actorCtx: ActorContext<TEvent, TEmitted> = {
    self: actor,
    name: options.id || 'anonymous',
    observers,
    _event: null as any
  };

  return actor;
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

export function createCallbackBehavior<TEvent extends EventObject>(
  lazyEntity: () => InvokeCallback
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

  const behavior: Behavior<TEvent, undefined> = {
    transition: (_, event, actorContext) => {
      if (event.type === startSignalType) {
        const sender: Sender<TEvent> = (e) => {
          if (canceled) {
            return;
          }

          sendNext(toSCXMLEvent(e, { origin: actorContext.self }));
        };

        const receiver: Receiver<TEvent> = (newListener) => {
          receivers.add(newListener);
        };

        const callbackEntity = lazyEntity();
        dispose = callbackEntity(sender, receiver);

        if (isPromiseLike(dispose)) {
          dispose.then(
            (resolved) => {
              sendNext(
                toSCXMLEvent(doneInvoke(actorContext.name, resolved) as any, {
                  origin: actorContext.self
                })
              );
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

export function createPromiseBehavior<T, TEvent extends EventObject>(
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
                  observer.done?.(response);
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

export function createObservableBehavior<
  T extends EventObject,
  TEvent extends EventObject
>(lazyObservable: Lazy<Subscribable<T>>): Behavior<TEvent, T | undefined> {
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
            sendNext(toSCXMLEvent(value, { origin: actorContext.self }));
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

// TODO: rethink how this plays with machines without all implementations being provided
export function createMachineBehavior<TMachine extends AnyStateMachine>(
  machine: TMachine | Lazy<TMachine>,
  options?: Partial<InterpreterOptions>
): Behavior<EventFrom<TMachine>, StateFrom<TMachine>> {
  let service: InterpreterFrom<TMachine> | undefined;
  let subscription: Subscription;
  let resolvedMachine: TMachine;

  const behavior: Behavior<EventFrom<TMachine>, StateFrom<TMachine>> = {
    transition: (state, event, actorContext) => {
      const { _parent: parent } = actorContext.self;
      resolvedMachine =
        resolvedMachine ?? (isFunction(machine) ? machine() : machine);

      if (event.type === startSignalType) {
        service = interpret(resolvedMachine as AnyStateMachine, {
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
          subscription = service.subscribe((state) => {
            parent?.send(
              toSCXMLEvent(
                {
                  type: actionTypes.update,
                  state
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
      resolvedMachine =
        resolvedMachine || (isFunction(machine) ? machine() : machine);
      return resolvedMachine.getInitialState();
    }
  };

  return behavior;
}

export function createBehaviorFrom<TEvent extends EventObject, TEmitted>(
  entity: PromiseLike<TEmitted>
): Behavior<TEvent, TEmitted>;
export function createBehaviorFrom<TEvent extends EventObject, TEmitted>(
  entity: Subscribable<any>
): Behavior<any, TEmitted>;
export function createBehaviorFrom<
  TEvent extends EventObject,
  TEmitted extends State<any, any>
>(
  entity: StateMachine<TEmitted['context'], TEmitted['event']>
): Behavior<TEvent, TEmitted>;
export function createBehaviorFrom<TEvent extends EventObject>(
  entity: InvokeCallback
): Behavior<TEvent, undefined>;
export function createBehaviorFrom(entity: Spawnable): Behavior<any, any> {
  if (isPromiseLike(entity)) {
    return createPromiseBehavior(() => entity);
  }

  if (isObservable<any>(entity)) {
    return createObservableBehavior(() => entity);
  }

  if (isStateMachine(entity)) {
    // @ts-ignore
    return createMachineBehavior(entity);
  }

  if (isFunction(entity)) {
    return createCallbackBehavior(() => entity);
  }

  throw new Error(`Unable to create behavior from entity`);
}

interface SpawnBehaviorOptions {
  id?: string;
  parent?: ActorRef<any>;
}
