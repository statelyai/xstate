import {
  EventObject,
  Actor,
  ActorCreator,
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

export function machineToActor(
  machine: MachineNode<any, any>,
  id: string,
  parent: Actor,
  options?: { sync?: boolean }
): Actor {
  const service = interpret(machine, {
    ...options, // inherit options from this interpreter
    parent,
    id
  });

  if (options && options.sync) {
    service.onTransition(state => {
      parent.send({
        type: actionTypes.update,
        state,
        id: service.id
      });
    });
  }

  service
    .onDone(doneEvent => {
      parent.send(
        toSCXMLEvent(doneInvoke(service.id, doneEvent.data), {
          origin: service.id
        })
      );
    })
    .start();

  return service as Actor;
}
export function spawnMachine<
  TContext,
  TEvent extends EventObject,
  TMachine extends MachineNode<any, any, any>
>(
  machine: TMachine | ((ctx: TContext, event: TEvent) => TMachine),
  options: { sync?: boolean } = {}
): ActorCreator<TContext, TEvent> {
  return (ctx, event, { parent, id, data, _event }) => {
    let resolvedMachine = isFunction(machine) ? machine(ctx, event) : machine;
    if (data) {
      resolvedMachine = resolvedMachine.withContext(
        mapContext(data, ctx, _event)
      ) as TMachine;
    }

    return machineToActor(resolvedMachine, id, parent, { sync: options.sync });
  };
}

export function promiseToActor<T>(
  promise: PromiseLike<T>,
  id: string,
  parent: Actor
): Actor {
  let canceled = false;

  promise.then(
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
        }
      }
    }
  );

  const actor = {
    id,
    send: () => void 0,
    subscribe: (next, handleError, complete) => {
      let unsubscribed = false;
      promise.then(
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
}
export function spawnPromise<T>(
  promise:
    | PromiseLike<T>
    | ((ctx: any, event: AnyEventObject) => PromiseLike<T>)
): ActorCreator<any, AnyEventObject> {
  return (ctx, e, { parent, id }) => {
    const resolvedPromise = isFunction(promise) ? promise(ctx, e) : promise;

    return promiseToActor(resolvedPromise, id, parent);
  };
}

export function spawnActivity<TC, TE extends EventObject>(
  activityCreator: (ctx: TC, event: TE) => any
): ActorCreator<TC, TE> {
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

export function callbackToActor<TEvent extends EventObject>(
  callback: InvokeCallback<TEvent>,
  id: string,
  parent: Actor
): Actor {
  let canceled = false;
  const receivers = new Set<(e: EventObject) => void>();
  const listeners = new Set<(e: EventObject) => void>();

  const receive = (receivedEvent: TEvent) => {
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
    return promiseToActor(callbackStop, id, parent);
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
}
export function spawnCallback<TE extends EventObject = AnyEventObject>(
  callbackCreator: (ctx: any, e: any) => InvokeCallback<TE>
): ActorCreator<any, AnyEventObject> {
  return (ctx, event, { parent, id }) => {
    const callback = callbackCreator(ctx, event);

    return callbackToActor(callback, id, parent);
  };
}

export function observableToActor(
  observable: Subscribable<any>,
  id: string,
  parent: Actor
): Actor {
  const subscription = observable.subscribe(
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
      return observable.subscribe(next, handleError, complete);
    },
    stop: () => subscription.unsubscribe(),
    toJSON() {
      return { id };
    }
  };

  return actor;
}
export function spawnObservable<T extends EventObject = AnyEventObject>(
  source: Subscribable<T> | ((ctx: any, event: any) => Subscribable<T>)
): ActorCreator<any, any> {
  return (ctx, e, { parent, id }) => {
    const resolvedSource = isFunction(source) ? source(ctx, e) : source;

    return observableToActor(resolvedSource, id, parent);
  };
}

export function actorFrom<TEvent extends EventObject>(
  entity: Spawnable<TEvent>,
  id: string,
  parent: Actor,
  options?: { sync?: boolean } // TODO: add back in
): Actor {
  if (isPromiseLike(entity)) {
    return promiseToActor(Promise.resolve(entity), id, parent);
  } else if (isFunction(entity)) {
    return callbackToActor(entity as InvokeCallback<TEvent>, id, parent);
  } else if (isActor(entity)) {
    return entity;
  } else if (isObservable<TEvent>(entity)) {
    return observableToActor(entity, id, parent);
  } else if (isMachineNode(entity)) {
    return machineToActor(entity, id, parent, options);
  } else {
    throw new Error(
      `Unable to spawn entity "${id}" of type "${typeof entity}".`
    );
  }
}

export function spawnFrom<TContext, TEvent extends EventObject>(
  entity: Spawnable<TEvent>,
  name: string
  // options?: SpawnOptions // TODO: add back in
): ActorCreator<TContext, TEvent> {
  if (isPromiseLike(entity)) {
    return spawnPromise(Promise.resolve(entity));
  } else if (isFunction(entity)) {
    return spawnCallback(() => entity as InvokeCallback<TEvent>);
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

export const createInvocationId = (() => {
  let count = 0;

  return () => `__xstate.invoke:${count++}`;
})();
