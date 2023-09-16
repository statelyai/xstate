import {
  ActorSystem,
  ActorSystemInfo,
  AnyActorRef,
  InspectionEvent,
  Observer,
  ResolvedInspectionEvent
} from './types.ts';
import { uniqueId } from './utils.ts';

let systemCounter = 0;
export function createSystem<T extends ActorSystemInfo>(
  rootActor: AnyActorRef
): ActorSystem<T> {
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();
  const observers = new Set<Observer<ResolvedInspectionEvent>>();

  const system: ActorSystem<T> = {
    root: rootActor,
    _bookId: () => `x:${systemCounter++}`,
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
        rootId: system.root.sessionId
      };
      observers.forEach((observer) => observer.next?.(resolvedInspectionEvent));
    },
    sendTo: (target, event, source) => {
      system._sendInspectionEvent({
        type: '@xstate.event',
        event,
        targetId: target?.sessionId ?? 'deadletter',
        sourceId: source?.sessionId
      });

      target?._send(event);
    }
  };

  return system;
}
