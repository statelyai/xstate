import {
  ActorSystem,
  ActorSystemInfo,
  AnyActorRef,
  Observer
} from './types.js';
import { toObserver } from './utils.ts';

export function createSystem<T extends ActorSystemInfo>(): ActorSystem<T> {
  let sessionIdCounter = 0;
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();
  const observers = new Set<Observer<any>>();

  function notifyObservers() {
    observers.forEach((observer) => {
      observer.next?.({
        context: { actors: keyedActors }
      });
    });
  }

  const system: ActorSystem<T> = {
    _bookId: () => `x:${sessionIdCounter++}`,
    _register: (sessionId, actorRef) => {
      children.set(sessionId, actorRef);
      notifyObservers();

      return sessionId;
    },
    _unregister: (actorRef) => {
      children.delete(actorRef.sessionId);
      const systemId = reverseKeyedActors.get(actorRef);

      if (systemId !== undefined) {
        keyedActors.delete(systemId);
        reverseKeyedActors.delete(actorRef);
      }
    },
    get: (systemId) => {
      return keyedActors.get(systemId) as T['actors'][any];
    },
    _set: (systemId, actorRef) => {
      const existing = keyedActors.get(systemId);
      if (existing && existing !== actorRef) {
        throw new Error(
          `Actor with system ID '${systemId as string}' already exists.`
        );
      }

      keyedActors.set(systemId, actorRef);
      reverseKeyedActors.set(actorRef, systemId);
    },
    subscribe: (obsOrFn) => {
      const observer = toObserver(obsOrFn);
      observers.add(observer);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
    },
    _stop: () => {
      children.clear();
      keyedActors.clear();
    },
    getSnapshot: () => {
      return {
        context: { actors: keyedActors }
      };
    }
  };

  return system;
}
