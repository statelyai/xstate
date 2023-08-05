import { ActorSystem, ActorSystemInfo, AnyActorRef } from './types.js';

import { interpret } from './interpreter.ts';

let count = 0;
export function createSystem<T extends ActorSystemInfo>(): ActorSystem<T> {
  let sessionIdCounter = 0;
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();

  const systemState = {
    id: 'system:' + count++,
    _bookId: () => `x:${sessionIdCounter++}`,
    _register: (sessionId, actorRef) => {
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
    _stop: () => {
      children.clear();
      keyedActors.clear();
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
    }
  };

  const logic = {
    transition: (state, event, actorCtx) => {
      return state;
    },
    getInitialState: () => systemState,
    getSnapshot: () => children,
    getPersistedState: () => null,
    restoreState: () => null,
    _system: systemState
  };

  const system = interpret(logic);

  system.get = systemState.get;
  system._set = systemState._set;
  system._bookId = systemState._bookId;
  system._register = systemState._register;
  system._unregister = systemState._unregister;
  system._stop = systemState._stop;

  return system;
}
