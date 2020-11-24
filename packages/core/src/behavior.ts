import {
  EventObject,
  InvokeCallback,
  Subscribable,
  Subscription,
  InterpreterOptions,
  Spawnable,
  Observer,
  ActorRef,
  Lazy,
  Sender,
  Receiver
} from './types';
import {
  toSCXMLEvent,
  isPromiseLike,
  isObservable,
  isMachineNode,
  isSCXMLEvent,
  isFunction
} from './utils';
import { doneInvoke, error, actionTypes } from './actions';
import { MachineNode } from './MachineNode';
import { interpret, Interpreter } from './interpreter';
import { State } from './State';

export interface ActorContext {
  self: ActorRef<any, any>; // TODO: use type params
  name: string;
}

export const startSignal = Symbol.for('xstate.invoke');
export const stopSignal = Symbol.for('xstate.stop');

export type LifecycleSignal = typeof startSignal | typeof stopSignal;

/**
 * An object that expresses the behavior of an actor in reaction to received events,
 * as well as an optionally emitted stream of values.
 *
 * @template TReceived The received event
 * @template TEmitted The emitted value
 */
export interface Behavior<TReceived extends EventObject, TEmitted> {
  receive: (
    actorContext: ActorContext,
    event: TReceived
  ) => Behavior<TReceived, TEmitted>;
  receiveSignal: (
    actorContext: ActorContext,
    signal: LifecycleSignal
  ) => Behavior<TReceived, TEmitted>;
  /**
   * The initial emitted value
   */
  initial: TEmitted;
  subscribe?: (observer: Observer<TEmitted>) => Subscription | undefined;
}

export function createDeferredBehavior<TEvent extends EventObject>(
  lazyEntity: () => InvokeCallback,
  parent?: ActorRef<any>
): Behavior<TEvent, undefined> {
  let canceled = false;
  const receivers = new Set<(e: EventObject) => void>();
  let dispose;

  const behavior: Behavior<TEvent, undefined> = {
    receive: (_, event) => {
      const plainEvent = isSCXMLEvent(event) ? event.data : event;
      receivers.forEach((receiver) => receiver(plainEvent));

      return behavior;
    },
    receiveSignal: (actorContext, signal) => {
      if (signal === startSignal) {
        const sender: Sender<TEvent> = (e) => {
          if (canceled) {
            return;
          }

          parent?.send(toSCXMLEvent(e, { origin: actorContext.self }));
        };

        const receiver: Receiver<TEvent> = (newListener) => {
          receivers.add(newListener);
        };

        const callbackEntity = lazyEntity();
        dispose = callbackEntity(sender, receiver);

        if (isPromiseLike(dispose)) {
          dispose.then(
            (resolved) => {
              parent?.send(
                toSCXMLEvent(doneInvoke(actorContext.name, resolved) as any, {
                  origin: actorContext.self
                })
              );
              canceled = true;
            },
            (errorData) => {
              const errorEvent = error(actorContext.name, errorData);
              parent?.send(
                toSCXMLEvent(errorEvent, { origin: actorContext.self })
              );
              canceled = true;
            }
          );
        }
      }

      if (signal === stopSignal) {
        canceled = true;

        if (isFunction(dispose)) {
          dispose();
        }
      }

      return behavior;
    },
    initial: undefined
  };

  return behavior;
}

export function createPromiseBehavior<T, TEvent extends EventObject>(
  lazyPromise: Lazy<PromiseLike<T>>,
  parent?: ActorRef<any>
): Behavior<TEvent, T | undefined> {
  let canceled = false;
  const observers: Set<Observer<T>> = new Set();

  const behavior: Behavior<TEvent, T | undefined> = {
    receive: () => {
      return behavior;
    },
    receiveSignal: (actorContext: ActorContext, signal: LifecycleSignal) => {
      switch (signal) {
        case startSignal:
          const resolvedPromise = Promise.resolve(lazyPromise());

          resolvedPromise.then(
            (response) => {
              if (!canceled) {
                parent?.send(
                  toSCXMLEvent(doneInvoke(actorContext.name, response) as any, {
                    origin: actorContext.self
                  })
                );

                observers.forEach((observer) => {
                  observer.next?.(response);
                  observer.complete?.();
                });
              }
            },
            (errorData) => {
              if (!canceled) {
                const errorEvent = error(actorContext.name, errorData);

                parent?.send(
                  toSCXMLEvent(errorEvent, { origin: actorContext.self })
                );

                console.log('received error', errorData);

                observers.forEach((observer) => {
                  observer.error?.(errorData);
                });
              }
            }
          );
          return behavior;
        case stopSignal:
          canceled = true;
          observers.clear();
          return behavior;
        default:
          return behavior;
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
    initial: undefined
  };

  return behavior;
}

export function createObservableBehavior<
  T extends EventObject,
  TEvent extends EventObject
>(
  lazyObservable: Lazy<Subscribable<T>>,
  parent?: ActorRef<any>
): Behavior<TEvent, T | undefined> {
  let subscription: Subscription | undefined;
  let observable: Subscribable<T> | undefined;

  const behavior: Behavior<TEvent, T | undefined> = {
    receiveSignal: (actorContext, signal) => {
      if (signal === startSignal) {
        observable = lazyObservable();
        subscription = observable.subscribe(
          (value) => {
            parent?.send(toSCXMLEvent(value, { origin: actorContext.self }));
          },
          (err) => {
            parent?.send(
              toSCXMLEvent(error(actorContext.name, err) as any, {
                origin: actorContext.self
              })
            );
          },
          () => {
            parent?.send(
              toSCXMLEvent(doneInvoke(actorContext.name) as any, {
                origin: actorContext.self
              })
            );
          }
        );
      } else if (signal === stopSignal) {
        subscription && subscription.unsubscribe();
      }

      return behavior;
    },
    receive: () => behavior,
    subscribe: (observer) => {
      return observable?.subscribe(observer);
    },
    initial: undefined
  };

  return behavior;
}

export function createMachineBehavior<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, TEvent> | Lazy<MachineNode<TContext, TEvent>>,
  parent?: ActorRef<any>,
  options?: Partial<InterpreterOptions>
): Behavior<TEvent, State<TContext, TEvent>> {
  let service: Interpreter<TContext, TEvent> | undefined;
  let subscription: Subscription;
  let resolvedMachine: MachineNode<TContext, TEvent>;

  const behavior: Behavior<TEvent, State<TContext, TEvent>> = {
    receiveSignal: (actorContext, signal) => {
      resolvedMachine = isFunction(machine) ? machine() : machine;

      if (signal === startSignal) {
        service = interpret(resolvedMachine, {
          ...options,
          parent,
          id: actorContext.name
        });
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
      } else if (signal === stopSignal) {
        service?.stop();
        subscription && subscription.unsubscribe(); // TODO: might not be necessary
      }
      return behavior;
    },
    receive: (_, event) => {
      service?.send(event);
      return behavior;
    },
    subscribe: (observer) => {
      return service?.subscribe(observer);
    },
    get initial() {
      resolvedMachine =
        resolvedMachine || (isFunction(machine) ? machine() : machine);
      return resolvedMachine.initialState; // TODO: this should get from machine.getInitialState(ref)
    }
  };

  return behavior;
}

export function createServiceBehavior<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, TEvent>
): Behavior<TEvent, State<TContext, TEvent>> {
  const behavior: Behavior<TEvent, State<TContext, TEvent>> = {
    receive: (actorContext, event) => {
      service.send(toSCXMLEvent(event, { origin: actorContext.self }));
      return behavior;
    },
    receiveSignal: () => {
      return behavior;
    },
    subscribe: (observer) => {
      return service.subscribe(observer);
    },
    initial: service.state
  };

  return behavior;
}

export function createBehaviorFrom<TEvent extends EventObject, TEmitted>(
  entity: PromiseLike<TEmitted>,
  parent?: ActorRef<any>
): Behavior<TEvent, TEmitted>;
export function createBehaviorFrom<TEvent extends EventObject, TEmitted>(
  entity: Subscribable<any>,
  parent?: ActorRef<any>
): Behavior<any, TEmitted>;
export function createBehaviorFrom<
  TEvent extends EventObject,
  TEmitted extends State<any, any>
>(
  entity: MachineNode<TEmitted['context'], any, TEmitted['event']>,
  parent?: ActorRef<any>
): Behavior<TEvent, TEmitted>;
export function createBehaviorFrom<TEvent extends EventObject>(
  entity: InvokeCallback,
  parent?: ActorRef<any>
): Behavior<TEvent, undefined>;
export function createBehaviorFrom(
  entity: Spawnable,
  parent?: ActorRef<any>
): Behavior<any, any> {
  if (isPromiseLike(entity)) {
    return createPromiseBehavior(() => entity, parent);
  }

  if (isObservable(entity)) {
    return createObservableBehavior(() => entity, parent);
  }

  if (isMachineNode(entity)) {
    // @ts-ignore
    return createMachineBehavior(entity, parent);
  }

  if (isFunction(entity)) {
    return createDeferredBehavior(() => entity as InvokeCallback, parent);
  }

  throw new Error(`Unable to create behavior from entity`);
}
