import { ActorSystem, ActorSystemInfo, AnyActorRef } from './types.js';

export function createSystem<T extends ActorSystemInfo>(): ActorSystem<T> {
  let sessionIdCounter = 0;
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();

  const system: ActorSystem<T> = {
    _bookId: () => `x:${sessionIdCounter++}`,
    _register: (id, actorRef) => {
      children.set(id, actorRef);
      return id;
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
      keyedActors.set(systemId, actorRef);
      reverseKeyedActors.set(actorRef, systemId);
    }
  };

  return system;
}
