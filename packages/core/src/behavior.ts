import {
  EventObject,
  InvokeCallback,
  Subscribable,
  Unsubscribable,
  InterpreterOptions,
  Spawnable,
  Observer
} from './types';
import { ActorRef } from './Actor';
import {
  toSCXMLEvent,
  isPromiseLike,
  isObservable,
  isMachineNode,
  isSCXMLEvent
} from './utils';
import { doneInvoke, error, actionTypes } from './actions';
import { isFunction } from 'util';
import { MachineNode } from './MachineNode';
import { interpret, Interpreter } from './interpreter';
import { State } from './State';

export interface ActorContext {
  self: ActorRef<any, any>; // TODO: use type params
  name: string;
}

export const startSignal = Symbol('xstate.start');
export const stopSignal = Symbol('xstate.stop');

export type LifecycleSignal = typeof startSignal | typeof stopSignal;

export interface Behavior<
  TEvent extends EventObject,
  TEmitted extends any = never
> {
  receive: (actorContext: ActorContext, event: TEvent) => Behavior<TEvent>;
  receiveSignal: (
    actorContext: ActorContext,
    signal: LifecycleSignal
  ) => Behavior<TEvent>;
  /**
   * The initial emitted value
   */
  initial: TEmitted;
  subscribe?: (observer: Observer<TEmitted>) => Unsubscribable | undefined;
}

export function createCallbackBehavior<TEvent extends EventObject>(
  callback: InvokeCallback,
  parent?: ActorRef<any>
): Behavior<TEvent> {
  let canceled = false;
  const receivers = new Set<(e: EventObject) => void>();
  let dispose;

  const behavior: Behavior<TEvent> = {
    receive: (_, event) => {
      const plainEvent = isSCXMLEvent(event) ? event.data : event;
      receivers.forEach((receiver) => receiver(plainEvent));

      return behavior;
    },
    receiveSignal: (actorContext, signal) => {
      if (signal === startSignal) {
        dispose = callback(
          (e) => {
            if (canceled) {
              return;
            }

            parent?.send(toSCXMLEvent(e, { origin: actorContext.self }));
          },
          (newListener) => {
            receivers.add(newListener);
          }
        );

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
              // TODO: handle error
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
    }
  };

  return behavior;
}

export function createPromiseBehavior<T, TEvent extends EventObject>(
  promise: PromiseLike<T>,
  parent?: ActorRef<any>
): Behavior<TEvent, T> {
  let canceled = false;
  const observers: Set<Observer<T>> = new Set();

  const behavior: Behavior<TEvent, T> = {
    receive: () => {
      return behavior;
    },
    receiveSignal: (actorContext: ActorContext, signal: LifecycleSignal) => {
      switch (signal) {
        case startSignal:
          const resolvedPromise = Promise.resolve(promise);

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

                observers.forEach((observer) => {
                  observer.error?.(errorData);
                  observer.complete?.();
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
    }
  };

  return behavior;
}

export function createObservableBehavior<
  T extends EventObject,
  TEvent extends EventObject
>(observable: Subscribable<T>, parent?: ActorRef<any>): Behavior<TEvent, T> {
  let subscription: Unsubscribable | undefined;

  const behavior: Behavior<TEvent, T> = {
    receiveSignal: (actorContext, signal) => {
      if (signal === startSignal) {
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
      return observable.subscribe(observer);
    }
  };

  return behavior;
}

export function createMachineBehavior<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, any, TEvent>,
  parent?: ActorRef<any>,
  options?: Partial<InterpreterOptions>
): Behavior<TEvent, State<TContext, TEvent>> {
  let service: Interpreter<TContext, any, TEvent>;
  let subscription: Unsubscribable;

  const behavior: Behavior<TEvent, State<TContext, TEvent>> = {
    receiveSignal: (actorContext, signal) => {
      if (signal === startSignal) {
        service = interpret(machine, {
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
        service.stop();
        subscription && subscription.unsubscribe(); // TODO: might not be necessary
      }
      return behavior;
    },
    receive: (_, event) => {
      service.send(event);
      return behavior;
    },
    subscribe: (observer) => {
      return service?.subscribe(observer);
    },
    initial: machine.initialState // TODO: this should get from machine.getInitialState(ref)
  };

  return behavior;
}

export function createServiceBehavior<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent>
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
    initial: service.current
  };

  return behavior;
}

export function createBehaviorFrom<TEvent extends EventObject, TEmitted>(
  entity: PromiseLike<TEmitted>,
  parent?: ActorRef<any>
): Behavior<TEvent, TEmitted>;
export function createBehaviorFrom<TEvent extends EventObject, TEmitted>(
  entity: Subscribable<TEmitted>,
  parent?: ActorRef<any>
): Behavior<TEvent, TEmitted>;
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
): Behavior<TEvent, never>;
export function createBehaviorFrom<TEvent extends EventObject, TEmitted>(
  entity: Spawnable,
  parent?: ActorRef<any>
): Behavior<TEvent, TEmitted> {
  if (isPromiseLike(entity)) {
    return createPromiseBehavior(entity, parent);
  }

  if (isObservable(entity)) {
    return createObservableBehavior(entity, parent);
  }

  if (isMachineNode(entity)) {
    // @ts-ignore
    return createMachineBehavior(entity, parent);
  }

  if (isFunction(entity)) {
    return createCallbackBehavior(entity as InvokeCallback, parent);
  }

  throw new Error(`Unable to create behavior from entity`);
}
