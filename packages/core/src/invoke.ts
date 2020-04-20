import { EventObject, ActorCreator, InvokeCallback, Subscribable } from '.';

import {
  ActorRef,
  fromService,
  fromCallback,
  fromObservable,
  fromPromise
} from './Actor';

import { interpret } from './interpreter';

import { actionTypes, doneInvoke, error } from './actions';

import {
  toSCXMLEvent,
  reportUnhandledExceptionOnInvocation,
  isFunction,
  isPromiseLike,
  mapContext
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
): ActorCreator<TContext, TEvent> {
  return (ctx, event, { parent, id, data, _event }) => {
    let resolvedMachine = isFunction(machine) ? machine(ctx, event) : machine;
    if (data) {
      resolvedMachine = resolvedMachine.withContext(
        mapContext(data, ctx, _event)
      ) as TMachine;
    }
    const childService = interpret(resolvedMachine, {
      ...options,
      parent,
      id: id || resolvedMachine.id,
      clock: (parent as any).clock
    });

    const resolvedOptions = {
      ...DEFAULT_SPAWN_OPTIONS,
      ...options
    };

    if (resolvedOptions.sync) {
      childService.onTransition((state) => {
        parent.send(({
          type: actionTypes.update,
          state,
          id: childService.id
        } as any) as TEvent); // todo: fix or remove
      });
    }

    const actorRef = fromService(childService);

    childService
      .onDone((doneEvent) => {
        parent.send(
          (toSCXMLEvent(doneInvoke(id, doneEvent.data), {
            origin: actorRef
          }) as any) as TEvent // todo: fix or remove
        );
      })
      .start();

    return actorRef;
  };
}

export function spawnPromise<T>(
  promise:
    | PromiseLike<T>
    | ((ctx: any, event: AnyEventObject) => PromiseLike<T>)
): ActorCreator<any, AnyEventObject> {
  return (ctx, e, { parent, id }) => {
    let canceled = false;

    const resolvedPromise = isFunction(promise) ? promise(ctx, e) : promise;

    const actorRef = fromPromise(resolvedPromise, parent, id);

    return actorRef;
  };
}

export function spawnActivity<TC, TE extends EventObject>(
  activityCreator: (ctx: TC, event: TE) => any
): ActorCreator<TC, TE> {
  const callbackCreator = (ctx: TC, event: TE) => () => {
    return activityCreator(ctx, event);
  };
  return spawnCallback<TC, TE>(callbackCreator);
}

export function spawnCallback<TC, TE extends EventObject = AnyEventObject>(
  callbackCreator: (ctx: any, e: any) => InvokeCallback
): ActorCreator<any, AnyEventObject> {
  return (ctx, event, { parent, id, _event }) => {
    const callback = callbackCreator(ctx, event);
    // let canceled = false;
    // const receivers = new Set<(e: EventObject) => void>();
    // const listeners = new Set<(e: EventObject) => void>();

    // console.log(callback);

    // const receive = (receivedEvent: TE) => {
    //   listeners.forEach((listener) => listener(receivedEvent));
    //   if (canceled) {
    //     return;
    //   }
    //   parent.send(receivedEvent);
    // };

    // let callbackStop;

    // try {
    //   callbackStop = callback(receive, (newListener) => {
    //     receivers.add(newListener);
    //   });
    // } catch (err) {
    //   parent.send(error(id, err) as any);
    // }

    // if (isPromiseLike(callbackStop)) {
    //   // it turned out to be an async function, can't reliably check this before calling `callback`
    //   // because transpiled async functions are not recognizable
    //   return spawnPromise(callbackStop as Promise<any>)(ctx, event, {
    //     parent,
    //     id,
    //     _event
    //   });
    // }

    const actorRef = fromCallback(callback, parent, id);

    return actorRef;

    // const actor = {
    //   id,
    //   send: (receivedEvent) =>
    //     receivers.forEach((receiver) => receiver(receivedEvent)),
    //   subscribe: (next) => {
    //     listeners.add(next);

    //     return {
    //       unsubscribe: () => {
    //         listeners.delete(next);
    //       }
    //     };
    //   },
    //   stop: () => {
    //     canceled = true;
    //     if (isFunction(callbackStop)) {
    //       callbackStop();
    //     }
    //   },
    //   toJSON() {
    //     return { id };
    //   }
    // };

    // return actor;
  };
}

export function spawnObservable<T extends EventObject = AnyEventObject>(
  source: Subscribable<T> | ((ctx: any, event: any) => Subscribable<T>)
): ActorCreator<any, any> {
  return (ctx, e, { parent, id }) => {
    const resolvedSource = isFunction(source) ? source(ctx, e) : source;
    // const subscription = resolvedSource.subscribe(
    //   (value) => {
    //     parent.send(toSCXMLEvent(value, { origin: id }));
    //   },
    //   (err) => {
    //     parent.send(toSCXMLEvent(error(id, err) as any, { origin: id }));
    //   },
    //   () => {
    //     parent.send(toSCXMLEvent(doneInvoke(id) as any, { origin: id }));
    //   }
    // );

    const actorRef = fromObservable(resolvedSource, parent, id);

    return actorRef;

    // const actor = {
    //   id,
    //   send: () => void 0,
    //   subscribe: (next, handleError, complete) => {
    //     return resolvedSource.subscribe(next, handleError, complete);
    //   },
    //   stop: () => subscription.unsubscribe(),
    //   toJSON() {
    //     return { id };
    //   }
    // };

    // return actor;
  };
}
