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
      if (keyedActors.has(systemId)) {
        throw new Error(
          `Actor with system ID '${systemId as string}' already exists.`
        );
      }

      keyedActors.set(systemId, actorRef);
      reverseKeyedActors.set(actorRef, systemId);
    }
  };

  return system;
}
