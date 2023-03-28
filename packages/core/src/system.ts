import { ActorSystem, ActorSystemInfo, AnyActorRef } from './types.js';

export function createSystem<T extends ActorSystemInfo>(): ActorSystem<T> {
  let sessionIdIndex = 0;
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();

  const system: ActorSystem<T> = {
    _register: (actorRef) => {
      const sessionId = `x:${sessionIdIndex++}`;
      children.set(sessionId, actorRef);
      return sessionId;
    },
    _unregister: (actorRef) => {
      children.delete(actorRef.sessionId);
      const key = reverseKeyedActors.get(actorRef);

      if (key !== undefined) {
        keyedActors.delete(key);
        reverseKeyedActors.delete(actorRef);
      }
    },
    get: (key) => {
      return keyedActors.get(key) as T['actors'][any];
    },
    _set: (key, actorRef) => {
      keyedActors.set(key, actorRef);
      reverseKeyedActors.set(actorRef, key);
    }
  };

  return system;
}
