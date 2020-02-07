import {
  EventObject,
  Actor,
  InvokeCreator,
  InvokeCallback,
  Subscribable,
  Spawnable
} from '.';

import { interpret } from './interpreter';

import { actionTypes, doneInvoke, error } from './actions';

import {
  reportUnhandledExceptionOnInvocation,
  isFunction,
  isPromiseLike,
  mapContext,
  isActor,
  isObservable,
  isMachineNode,
  toSCXMLEvent
} from './utils';
import { AnyEventObject } from './types';
import { MachineNode } from './MachineNode';

export const DEFAULT_SPAWN_OPTIONS = { sync: false };

export function spawnMachine<
  TContext,
  TEvent extends EventObject,
  TMachine extends MachineNode<any, any, any>
>(
  machine: TMachine | ((ctx: TContext, event: TEvent) => TMachine),
  options: { sync?: boolean } = {}
): InvokeCreator<TContext, TEvent> {
  return (ctx, event, { parent, id, data, _event }) => {
    let resolvedMachine = isFunction(machine) ? machine(ctx, event) : machine;
    if (data) {
      resolvedMachine = resolvedMachine.withContext(
        mapContext(data, ctx, _event)
      ) as TMachine;
    }
    const childService = interpret(resolvedMachine, {
      ...options, // inherit options from this interpreter
      parent,
      id: id || resolvedMachine.id
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
          toSCXMLEvent(doneInvoke(id, doneEvent.data), {
            origin: childService.id
          })
        );
      })
      .start();

    const actor = childService;

    return actor as Actor;
  };
}

export function spawnPromise<T>(
  promise:
    | PromiseLike<T>
    | ((ctx: any, event: AnyEventObject) => PromiseLike<T>)
): InvokeCreator<any, AnyEventObject> {
  return (ctx, e, { parent, id }) => {
    let canceled = false;

    const resolvedPromise = isFunction(promise) ? promise(ctx, e) : promise;

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
            //   canceled = true;
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

export function spawnActivity<TC, TE extends EventObject>(
  activityCreator: (ctx: TC, event: TE) => any
): InvokeCreator<TC, TE> {
  return (ctx, e, { parent, id }) => {
    let dispose;
    try {
      dispose = activityCreator(ctx, e);
    } catch (err) {
      parent.send(error(id, err) as any);
    }

    return {
      id,
      send: () => void 0,
      toJSON: () => ({ id }),
      subscribe() {
        // do nothing
        return {
          unsubscribe: () => void 0
        };
      },
      stop: isFunction(dispose) ? () => dispose() : undefined
    };
  };
}

export function spawnCallback<TE extends EventObject = AnyEventObject>(
  callbackCreator: (ctx: any, e: any) => InvokeCallback
): InvokeCreator<any, AnyEventObject> {
  return (ctx, event, { parent, id, _event }) => {
    const callback = callbackCreator(ctx, event);
    let canceled = false;
    const receivers = new Set<(e: EventObject) => void>();
    const listeners = new Set<(e: EventObject) => void>();

    const receive = (receivedEvent: TE) => {
      listeners.forEach(listener => listener(receivedEvent));
      if (canceled) {
        return;
      }
      parent.send(receivedEvent);
    };

    let callbackStop;

    try {
      callbackStop = callback(receive, newListener => {
        receivers.add(newListener);
      });
    } catch (err) {
      parent.send(error(id, err) as any);
    }

    if (isPromiseLike(callbackStop)) {
      // it turned out to be an async function, can't reliably check this before calling `callback`
      // because transpiled async functions are not recognizable
      return spawnPromise(callbackStop as Promise<any>)(ctx, event, {
        parent,
        id,
        _event
      });
    }

    const actor = {
      id,
      send: receivedEvent =>
        receivers.forEach(receiver => receiver(receivedEvent)),
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

export function spawnFrom<TContext, TEvent extends EventObject>(
  entity: Spawnable,
  name: string
  // options?: SpawnOptions // TODO: add back in
): InvokeCreator<TContext, TEvent> {
  if (isPromiseLike(entity)) {
    return spawnPromise(Promise.resolve(entity));
  } else if (isFunction(entity)) {
    return spawnCallback(entity as InvokeCallback);
  } else if (isActor(entity)) {
    return () => entity;
  } else if (isObservable<TEvent>(entity)) {
    return spawnObservable(entity);
  } else if (isMachineNode(entity)) {
    return spawnMachine(entity);
  } else {
    throw new Error(
      `Unable to spawn entity "${name}" of type "${typeof entity}".`
    );
  }
}
