import {
  AnyEventObject,
  ActorSystem,
  ActorSystemInfo,
  AnyActorRef,
  Observer,
  Snapshot
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
        ...event,
        rootId: rootActor.sessionId
      };
      observers.forEach((observer) => observer.next?.(resolvedInspectionEvent));
    },
    _relay: (source, target, event) => {
      system._sendInspectionEvent({
        type: '@xstate.event',
        event,
        targetId: target?.sessionId ?? 'deadletter',
        sessionId: source?.sessionId
      });

      target?._send(event);
    }
  };

  return system;
}
export interface BaseInspectionEvent {
  rootId: string; // the session ID of the root
}

export interface InspectedSnapshotEvent {
  type: '@xstate.snapshot';
  sessionId: string;
  snapshot: Snapshot<unknown>;
  event: AnyEventObject; // { type: string, ... }
  actorRef: AnyActorRef; // Only available locally
}

export interface InspectedEventEvent {
  type: '@xstate.event';
  // The sessionId may be undefined, e.g. for:
  // - root init events
  // - events sent from external (non-actor) sources
  sessionId: string | undefined;
  event: AnyEventObject; // { type: string, ... }
  targetId: string; // Session ID, required
}

export interface InspectedActorEvent {
  type: '@xstate.actor';
  sessionId: string;
  parentId?: string;
  actorRef: AnyActorRef;
}

export type InspectionEvent =
  | InspectedSnapshotEvent
  | InspectedEventEvent
  | InspectedActorEvent;

export type ResolvedInspectionEvent = InspectionEvent & BaseInspectionEvent;
