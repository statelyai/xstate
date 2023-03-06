import { ActorSystem, ActorSystemInfo, AnyActorRef } from './types.js';

export function createSystem<T extends ActorSystemInfo>(): ActorSystem<T> {
  let sessionIdIndex = 0;
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();

  const system: ActorSystem<T> = {
    register: (actorRef) => {
      const id = `x:${sessionIdIndex++}`;
      children.set(id, actorRef);
      return id;
    },
    unregister: (actorRef) => {
      children.delete(actorRef.id);
      const key = reverseKeyedActors.get(actorRef);

      if (key !== undefined) {
        keyedActors.delete(key);
        reverseKeyedActors.delete(actorRef);
      }
    },
    get: (key) => {
      return keyedActors.get(key) as T['actors'][any];
    },
    set: (key, actorRef) => {
      keyedActors.set(key, actorRef);
      reverseKeyedActors.set(actorRef, key);
    }
  };

  return system;
}
