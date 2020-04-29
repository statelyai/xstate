import {
  EventObject,
  InvokeCallback,
  SCXML,
  Subscribable,
  Unsubscribable,
  InterpreterOptions
} from './types';
import { ActorRef } from './Actor';
import { toSCXMLEvent, isPromiseLike } from './utils';
import { doneInvoke, error, actionTypes } from './actions';
import { isFunction } from 'util';
import { MachineNode } from './MachineNode';
import { interpret, Interpreter } from './interpreter';

export interface ActorContext {
  self: ActorRef<any>;
  name: string;
}

export const startSignal = Symbol('xstate.start');
export const stopSignal = Symbol('xstate.stop');

export type LifecycleSignal = typeof startSignal | typeof stopSignal;

export interface Behavior<TEvent extends EventObject> {
  receive: (actorContext: ActorContext, event: TEvent) => Behavior<TEvent>;
  receiveSignal: (
    actorContext: ActorContext,
    signal: LifecycleSignal
  ) => Behavior<TEvent>;
}

export function createCallbackBehavior<TEvent extends EventObject>(
  callback: InvokeCallback,
  parent: ActorRef<any>
): Behavior<SCXML.Event<TEvent>> {
  let canceled = false;
  const receivers = new Set<(e: EventObject) => void>();
  let dispose;

  const behavior: Behavior<SCXML.Event<TEvent>> = {
    receive: (_, event) => {
      receivers.forEach((receiver) => receiver(event.data));

      return behavior;
    },
    receiveSignal: (actorContext, signal) => {
      if (signal === startSignal) {
        dispose = callback(
          (e) => {
            if (canceled) {
              return;
            }

            parent.send(toSCXMLEvent(e, { origin: actorContext.self }));
          },
          (newListener) => {
            receivers.add(newListener);
          }
        );

        if (isPromiseLike(dispose)) {
          dispose.then(
            (resolved) => {
              parent.send(
                toSCXMLEvent(doneInvoke(actorContext.name, resolved) as any, {
                  origin: actorContext.self
                })
              );
              canceled = true;
            },
            (errorData) => {
              const errorEvent = error(actorContext.name, errorData);
              parent.send(
                toSCXMLEvent(errorEvent, { origin: actorContext.self })
              );
              // TODO: handle error
              canceled = true;
            }
          );
        }

        return behavior;
      }

      if (signal === stopSignal) {
        canceled = true;

        if (isFunction(dispose)) {
          dispose();
        }

        return behavior;
      }
    }
  };

  return behavior;
}

export function createPromiseBehavior<T, TEvent extends EventObject>(
  promise: PromiseLike<T>,
  parent: ActorRef<any>
): Behavior<TEvent> {
  let canceled = false;

  const behavior = {
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
                parent.send(
                  toSCXMLEvent(doneInvoke(actorContext.name, response) as any, {
                    origin: actorContext.self
                  })
                );
              }
            },
            (errorData) => {
              if (!canceled) {
                const errorEvent = error(actorContext.name, errorData);

                parent.send(
                  toSCXMLEvent(errorEvent, { origin: actorContext.self })
                );
              }
            }
          );
          return behavior;
        case stopSignal:
          canceled = true;
          return behavior;
        default:
          return behavior;
      }
    }
  };

  return behavior;
}

export function createObservableBehavior<
  T extends EventObject,
  TEvent extends EventObject
>(observable: Subscribable<T>, parent: ActorRef<any>): Behavior<TEvent> {
  let subscription: Unsubscribable;

  const behavior = {
    receiveSignal: (actorContext, signal) => {
      if (signal === startSignal) {
        subscription = observable.subscribe(
          (value) => {
            parent.send(toSCXMLEvent(value, { origin: actorContext.self }));
          },
          (err) => {
            parent.send(
              toSCXMLEvent(error(actorContext.name, err) as any, {
                origin: actorContext.self
              })
            );
          },
          () => {
            parent.send(
              toSCXMLEvent(doneInvoke(actorContext.name) as any, {
                origin: actorContext.self
              })
            );
          }
        );
        return behavior;
      }
      if (signal === stopSignal) {
        subscription && subscription.unsubscribe();
        return behavior;
      }
    },
    receive: () => behavior
  };

  return behavior;
}

export function createMachineBehavior<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, any, TEvent>,
  parent: ActorRef<any>,
  options?: Partial<InterpreterOptions>
): Behavior<TEvent> {
  let service: Interpreter<TContext, any, TEvent>;
  let subscription: Unsubscribable;

  const behavior: Behavior<TEvent> = {
    receiveSignal: (actorContext, signal) => {
      if (signal === startSignal) {
        service = interpret(machine, {
          ...options,
          parent,
          id: actorContext.name
        });
        service.onDone((doneEvent) => {
          parent.send(
            toSCXMLEvent(doneEvent, {
              origin: actorContext.self
            })
          );
        });

        if (options?.sync) {
          subscription = service.subscribe((state) => {
            parent.send(
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

        return behavior;
      }

      if (signal === stopSignal) {
        service.stop();
        subscription && subscription.unsubscribe(); // TODO: might not be necessary

        return behavior;
      }
    },
    receive: (_, event) => {
      service.send(event);
      return behavior;
    }
  };

  return behavior;
}

export function createServiceBehavior<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent>
): Behavior<TEvent> {
  const behavior = {
    receive: (actorContext, event) => {
      service.send(toSCXMLEvent(event, { origin: actorContext.self }));
      return behavior;
    },
    receiveSignal: () => {
      return behavior;
    }
  };

  return behavior;
}
