import {
  EventObject,
  Subscribable,
  InvokeDefinition,
  AnyEventObject,
  ActorRef,
  BaseActorRef,
  Observer
} from './types';
import {
  symbolObservable,
  toObserver,
  toSCXMLEvent,
  reportUnhandledExceptionOnInvocation,
  isPromiseLike,
  isFunction,
  isObservable,
  isMachine,
  isBehavior,
  wrapWithOrigin
} from './utils';
import { Interpreter } from './interpreter';
import { doneInvoke, error } from './actions';
import * as actionTypes from './actionTypes';
import { spawnBehavior } from './behaviors';

export interface Actor<
  TContext = any,
  TEvent extends EventObject = AnyEventObject
> extends Subscribable<TContext> {
  id: string;
  send: (event: TEvent) => any; // TODO: change to void
  stop?: () => any | undefined;
  toJSON: () => {
    id: string;
  };
  meta?: InvokeDefinition<TContext, TEvent>;
  state?: any;
  deferred?: boolean;
}

export function createNullActor(id: string): ActorRef<any> {
  return {
    id,
    send: () => void 0,
    subscribe: () => ({
      unsubscribe: () => void 0
    }),
    getSnapshot: () => undefined,
    toJSON: () => ({
      id
    }),
    [symbolObservable]: function () {
      return this;
    }
  };
}

interface SpawnOptions {
  name: string;
  autoForward: boolean;
  sync: boolean;
}

export const wrappedMachines = new WeakSet();

type DisposableObserver = Observer<any> & {
  unsubscribe?: () => void;
};

export function createDeferredActor(
  options: SpawnOptions,
  initialEntity?: any,
  data?: any
): { start: (...args: any[]) => void; actorRef: ActorRef<any, any> } {
  const { name } = options;
  let canceled = false;
  let emitted = data;
  let queued: any[] | null = [];
  let parent: any;

  let subscribers = new Set<DisposableObserver>();
  let receivers = new Set<{ send: (ev: any) => void }>();
  let boxedEntity:
    | {
        stop?: () => void;
        send?: (ev: any) => void;
        getSnapshot?: () => any;
        subscribe?: (observer: DisposableObserver) => void;
      }
    | undefined = initialEntity;

  const actorRef = initialEntity || {
    id: name,
    send: (ev) => {
      if (queued) {
        queued.push(ev);
        return;
      }
      if (boxedEntity && 'send' in boxedEntity) {
        boxedEntity.send!(
          wrappedMachines.has(actorRef)
            ? wrapWithOrigin(parent, toSCXMLEvent(ev))
            : ev
        );
        return;
      }
      receivers.forEach((receiver) => receiver.send(ev));
    },
    subscribe: (next, handleError?, complete?) => {
      const observer: DisposableObserver = toObserver(
        next,
        handleError,
        complete
      );
      subscribers.add(observer);

      boxedEntity?.subscribe?.(observer);

      return {
        unsubscribe: () => {
          subscribers.delete(observer);
          observer.unsubscribe?.();
        }
      };
    },
    stop: () => {
      canceled = true;
      boxedEntity?.stop?.();
    },
    toJSON() {
      return { id: name };
    },
    getSnapshot: () => {
      if (boxedEntity && 'getSnapshot' in boxedEntity) {
        return boxedEntity.getSnapshot!();
      }
      return emitted;
    },
    [symbolObservable]: function () {
      return this;
    }
  };

  return {
    actorRef,
    start({ parent: _parent, entity }: any) {
      parent = _parent;
      // defensive measure, ideally `_start` should never be called in such a state
      if (canceled) {
        return;
      }
      parent.children.set(name, actorRef);

      let entityOrStop: any;

      if (initialEntity) {
        // skip
      } else if (isMachine(entity) || isBehavior(entity)) {
        entityOrStop = entity;
      } else {
        try {
          const callbackSend = (e: typeof emitted) => {
            emitted = e;
            subscribers.forEach((observer) => observer.next(e));
            if (canceled) {
              return;
            }
            parent.send(toSCXMLEvent(e, { origin: name }));
          };
          const callbackOnReceive = (newListener) => {
            receivers.add({
              send: newListener
            });
          };

          entityOrStop = entity(callbackSend, callbackOnReceive);
        } catch (err) {
          parent.send(error(name, err));
          return;
        }
      }

      const startInterpreter = (service) => {
        if (options.sync) {
          service.onTransition((state) => {
            parent.send(actionTypes.update as any, {
              state,
              id: service.id
            });
          });
        }

        if (options.autoForward) {
          parent.forwardTo.add(service.id);
        }
        return service
          .onDone((doneEvent) => {
            parent.removeChild(service.id);
            parent.send(toSCXMLEvent(doneEvent as any, { origin: service.id }));
          })
          .start();
      };

      if (initialEntity && 'machine' in initialEntity) {
        startInterpreter(initialEntity);
        wrappedMachines.add(initialEntity);
      } else if (isActor(initialEntity)) {
        if ('machine' in initialEntity) {
          wrappedMachines.add(initialEntity);
        }
      } else if (isPromiseLike(entityOrStop)) {
        const promise = Promise.resolve(entityOrStop);
        promise.then(
          (response) => {
            if (!canceled) {
              emitted = response;
              parent.removeChild(name);
              parent.send(
                toSCXMLEvent(doneInvoke(name, response) as any, {
                  origin: name
                })
              );
            }
          },
          (errorData) => {
            subscribers.forEach((observer) => observer.error(errorData));

            if (!canceled) {
              parent.removeChild(name);
              const errorEvent = error(name, errorData);
              try {
                // Send "error.platform.id" to this (parent).
                parent.send(toSCXMLEvent(errorEvent as any, { origin: name }));
              } catch (error) {
                reportUnhandledExceptionOnInvocation(errorData, error, name);
                if (parent.devTools) {
                  parent.devTools.send(errorEvent, parent.state);
                }
                if (parent.machine.strict) {
                  // it would be better to always stop the state machine if unhandled
                  // exception/promise rejection happens but because we don't want to
                  // break existing code so enforce it on strict mode only especially so
                  // because documentation says that onError is optional
                  parent.stop();
                }
              }
            }
          }
        );
        boxedEntity = {
          subscribe: (observer) => {
            let unsubscribed = false;

            observer.unsubscribe = () => (unsubscribed = true);

            promise.then(
              (response) => {
                if (unsubscribed) {
                  return;
                }
                observer.next(response);
                if (unsubscribed) {
                  return;
                }
                observer.complete();
              },
              (err) => {
                if (unsubscribed) {
                  return;
                }
                observer.error(err);
              }
            );
          }
        };
      } else if (isFunction(entityOrStop)) {
        let callbackStop = entityOrStop;

        boxedEntity = {
          stop: callbackStop
        };
      } else if (isSpawnedActor(entityOrStop)) {
        boxedEntity = {
          stop: () => {
            entityOrStop.stop?.();
          },
          send: (ev) => {
            entityOrStop.send(ev);
          },
          subscribe: (observer) => {
            const subscription = entityOrStop.subscribe(observer);
            observer.unsubscribe = () => subscription.unsubscribe();
          }
        };
        if ('machine' in entityOrStop) {
          wrappedMachines.add(actorRef);
        }
      } else if (isObservable<any>(entityOrStop)) {
        const subscription = entityOrStop.subscribe(
          (value) => {
            emitted = value;
            parent.send(toSCXMLEvent(value, { origin: name }));
          },
          (err) => {
            parent.removeChild(name);
            parent.send(
              toSCXMLEvent(error(name, err) as any, { origin: name })
            );
          },
          () => {
            parent.removeChild(name);
            parent.send(
              toSCXMLEvent(doneInvoke(name) as any, { origin: name })
            );
          }
        );
        boxedEntity = {
          stop: () => {
            subscription.unsubscribe();
          },
          subscribe(observer) {
            const subscription = entityOrStop.subscribe(
              observer.next,
              observer.error,
              observer.complete
            );

            observer.unsubscribe = () => subscription.unsubscribe();
          }
        };
      } else if (isMachine(entityOrStop)) {
        const childService = new Interpreter(entityOrStop, {
          ...parent.options, // inherit options from this interpreter
          parent,
          id: name || entityOrStop.id
        });

        const interpreter = startInterpreter(childService);

        boxedEntity = {
          stop() {
            interpreter.stop();
          },
          send(ev) {
            interpreter.send(ev);
          },
          subscribe(observer) {
            const subscription = interpreter.subscribe();
            observer.unsubscribe = () => subscription.unsubscribe();
          },
          getSnapshot() {
            return interpreter.getSnapshot();
          }
        };

        wrappedMachines.add(actorRef);
      } else if (isBehavior(entityOrStop)) {
        const actorRef = spawnBehavior(entityOrStop, {
          id: name,
          parent
        });
        boxedEntity = {
          send: actorRef.send,
          subscribe: (observer) => {
            const subscription = actorRef.subscribe(observer);
            observer.unsubscribe = () => subscription.unsubscribe();
          },
          getSnapshot: actorRef.getSnapshot
        };
      }

      subscribers.forEach((observer) => boxedEntity?.subscribe?.(observer));

      const events = queued!;
      queued = null;
      events.forEach((event) => actorRef.send(event));
    }
  };
}

export function isActor(item: any): item is ActorRef<any> {
  try {
    return typeof item.send === 'function';
  } catch (e) {
    return false;
  }
}

export function isSpawnedActor(item: any): item is ActorRef<any> {
  return isActor(item) && 'id' in item;
}

// TODO: refactor the return type, this could be written in a better way but it's best to avoid unneccessary breaking changes now
export function toActorRef<
  TEvent extends EventObject,
  TEmitted = any,
  TActorRefLike extends BaseActorRef<TEvent> = BaseActorRef<TEvent>
>(
  actorRefLike: TActorRefLike
): ActorRef<TEvent, TEmitted> & Omit<TActorRefLike, keyof ActorRef<any, any>> {
  return {
    subscribe: () => ({ unsubscribe: () => void 0 }),
    id: 'anonymous',
    getSnapshot: () => undefined,
    [symbolObservable]: function () {
      return this;
    },
    ...actorRefLike
  };
}
