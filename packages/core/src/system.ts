import { ActorRef, ActorSystem, ActorSystemInfo } from './types.js';

export function createSystem<T extends ActorSystemInfo>(): ActorSystem<T> {
  let sessionIdIndex = 0;
  const children = new Map<string, ActorRef<any>>();
  const keyedActors = new Map<keyof T['actors'], ActorRef<any> | undefined>();

  return {
    register: (actorRef) => {
      const id = `x:${sessionIdIndex++}`;
      children.set(id, actorRef);
      return id;
    },
    unregister: (actorRef) => {
      children.delete(actorRef.id);
    },
    get: (key) => {
      return keyedActors.get(key) as T['actors'][any];
    },
    set: (key, actorRef) => {
      keyedActors.set(key, actorRef);
    }
  };
}
