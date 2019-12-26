import {
  EventObject,
  StateMachine,
  Interpreter,
  Actor,
  InvokeCreator,
  InvokeCallback,
  Subscribable
} from '.';

import { actionTypes, doneInvoke, error } from './actions';

import {
  toSCXMLEvent,
  reportUnhandledExceptionOnInvocation,
  isFunction
} from './utils';
import { AnyEventObject } from './types';

const DEFAULT_SPAWN_OPTIONS = { sync: false, autoForward: false };

export function spawnMachine<
  TChildContext,
  TChildStateSchema,
  TChildEvent extends EventObject
>(
  machine: StateMachine<TChildContext, TChildStateSchema, TChildEvent>,
  options: { id?: string; autoForward?: boolean; sync?: boolean } = {}
): InvokeCreator<any, TChildEvent> {
  return (_, __, { parent }) => {
    const childService = new Interpreter(machine, {
      ...this.options, // inherit options from this interpreter
      parent,
      id: options.id || machine.id
    });

    const resolvedOptions = {
      ...DEFAULT_SPAWN_OPTIONS,
      ...options
    };

    if (resolvedOptions.sync) {
      childService.onTransition(state => {
        parent.send({
          type: actionTypes.update,
          state,
          id: childService.id
        });
      });
    }

    childService
      .onDone(doneEvent => {
        parent.send(
          toSCXMLEvent(doneEvent as any, { origin: childService.id })
        );
      })
      .start();

    const actor = childService;

    // this.children.set(childService.id, actor as Actor<
    //   State<TChildContext, TChildEvent>,
    //   TChildEvent
    // >);

    // if (resolvedOptions.autoForward) {
    //   this.forwardTo.add(childService.id);
    // }

    return actor as Actor;
  };
}

export function spawnPromise<T>(
  promise: PromiseLike<T> | ((ctx: any) => PromiseLike<T>)
): InvokeCreator<any, AnyEventObject> {
  return (ctx, __, { parent, id }) => {
    let canceled = false;

    const resolvedPromise = isFunction(promise) ? promise(ctx) : promise;

    resolvedPromise.then(
      response => {
        if (!canceled) {
          parent.send(
            toSCXMLEvent(doneInvoke(id, response) as any, { origin: id })
          );
        }
      },
      errorData => {
        if (!canceled) {
          const errorEvent = error(id, errorData);
          try {
            // Send "error.platform.id" to this (parent).
            parent.send(toSCXMLEvent(errorEvent as any, { origin: id }));
          } catch (error) {
            reportUnhandledExceptionOnInvocation(errorData, error, id);
            // if (this.devTools) {
            //   this.devTools.send(errorEvent, this.state);
            // }
            // if (this.machine.strict) {
            //   // it would be better to always stop the state machine if unhandled
            //   // exception/promise rejection happens but because we don't want to
            //   // break existing code so enforce it on strict mode only especially so
            //   // because documentation says that onError is optional
            //   this.stop();
            // }
          }
        }
      }
    );

    const actor = {
      id,
      send: () => void 0,
      subscribe: (next, handleError, complete) => {
        let unsubscribed = false;
        resolvedPromise.then(
          response => {
            if (unsubscribed) {
              return;
            }
            next && next(response);
            if (unsubscribed) {
              return;
            }
            complete && complete();
          },
          err => {
            if (unsubscribed) {
              return;
            }
            handleError(err);
          }
        );

        return {
          unsubscribe: () => (unsubscribed = true)
        };
      },
      stop: () => {
        canceled = true;
      },
      toJSON() {
        return { id };
      }
    };

    return actor;
  };
}

export function spawnCallback<TE extends EventObject = AnyEventObject>(
  callback: (ctx: any, e: any) => InvokeCallback
): InvokeCreator<any, AnyEventObject> {
  return (_, __, { parent, id }) => {
    let canceled = false;
    const receivers = new Set<(e: EventObject) => void>();
    const listeners = new Set<(e: EventObject) => void>();

    const receive = (e: TE) => {
      listeners.forEach(listener => listener(e));
      if (canceled) {
        return;
      }
      parent.send(e);
    };

    let callbackStop;

    try {
      callbackStop = callback(receive, newListener => {
        receivers.add(newListener);
      });
    } catch (err) {
      parent.send(error(id, err) as any);
    }

    // if (isPromiseLike(callbackStop)) {
    //   // it turned out to be an async function, can't reliably check this before calling `callback`
    //   // because transpiled async functions are not recognizable
    //   return this.spawnPromise(callbackStop as Promise<any>, id);
    // }

    const actor = {
      id,
      send: event => receivers.forEach(receiver => receiver(event)),
      subscribe: next => {
        listeners.add(next);

        return {
          unsubscribe: () => {
            listeners.delete(next);
          }
        };
      },
      stop: () => {
        canceled = true;
        if (isFunction(callbackStop)) {
          callbackStop();
        }
      },
      toJSON() {
        return { id };
      }
    };

    return actor;
  };
}

export function spawnObservable<T extends EventObject = AnyEventObject>(
  source: Subscribable<T> | ((ctx: any, event: any) => Subscribable<T>)
): InvokeCreator<any, any> {
  return (ctx, e, { parent, id }) => {
    const resolvedSource = isFunction(source) ? source(ctx, e) : source;
    const subscription = resolvedSource.subscribe(
      value => {
        parent.send(toSCXMLEvent(value, { origin: id }));
      },
      err => {
        parent.send(toSCXMLEvent(error(id, err) as any, { origin: id }));
      },
      () => {
        parent.send(toSCXMLEvent(doneInvoke(id) as any, { origin: id }));
      }
    );

    const actor = {
      id,
      send: () => void 0,
      subscribe: (next, handleError, complete) => {
        return resolvedSource.subscribe(next, handleError, complete);
      },
      stop: () => subscription.unsubscribe(),
      toJSON() {
        return { id };
      }
    };

    return actor;
  };
}
