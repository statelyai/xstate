import {
  ActorSystem,
  ActorSystemInfo,
  AnyActorRef,
  Observer,
  ResolvedInspectionEvent
} from './types.ts';

let systemCounter = 0;
export function createSystem<T extends ActorSystemInfo>(
  rootActor: AnyActorRef
): ActorSystem<T> {
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();
  const observers = new Set<Observer<ResolvedInspectionEvent>>();

  const system: ActorSystem<T> = {
    _bookId: (name: string = 'x') => `${name}:${systemCounter++}`,
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
    inspect: (observer) => {
      observers.add(observer);
    },
    _sendInspectionEvent: (event) => {
      const resolvedInspectionEvent: ResolvedInspectionEvent = {
        id: Math.random().toString(),
        createdAt: new Date().toString(),
        ...event,
        actorSystemId: rootActor.sessionId
      };
      observers.forEach((observer) => observer.next?.(resolvedInspectionEvent));
    },
    sendTo: (target, event, source) => {
      const sourceId = source?.sessionId;
      const id = `${sourceId ?? 'anon'}--${Math.random().toString()}`;
      system._sendInspectionEvent({
        type: '@xstate.event',
        event,
        targetId: target?.sessionId ?? 'deadletter',
        sourceId: source?.sessionId
      });

      Object.defineProperty(event, '__id', {
        value: id,
        enumerable: false,
        writable: true
      });

      target?.send(event);
    }
  };

  return system;
}
