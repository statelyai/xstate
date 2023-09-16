import {
  AnyEventObject,
  ActorSystem,
  ActorSystemInfo,
  AnyActorRef,
  Observer
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
    relay: (event, source, target) => {
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
export interface BaseInspectionEvent {
  rootId: string; // the session ID of the root
  createdAt: string; // Timestamp
  id: string; // unique string for this actor update
}

export interface InspectedSnapshotEvent {
  type: '@xstate.snapshot';
  snapshot: any;
  event: AnyEventObject; // { type: string, ... }
  status: 0 | 1 | 2; // 0 = not started, 1 = started, 2 = stopped
  sessionId: string;
  actorRef: AnyActorRef; // Only available locally
}

export interface InspectedEventEvent {
  type: '@xstate.event';
  event: AnyEventObject; // { type: string, ... }
  sourceId: string | undefined; // Session ID
  targetId: string; // Session ID, required
}

export interface InspectedActorEvent {
  type: '@xstate.actor';
  actorRef: AnyActorRef;
  sessionId: string;
  parentId?: string;
}

export type InspectionEvent =
  | InspectedSnapshotEvent
  | InspectedEventEvent
  | InspectedActorEvent;

export type ResolvedInspectionEvent = InspectionEvent & BaseInspectionEvent;
