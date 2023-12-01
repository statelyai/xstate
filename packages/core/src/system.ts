import {
  AnyEventObject,
  ActorSystem,
  ActorSystemInfo,
  AnyActorRef,
  Observer,
  Snapshot
} from './types.ts';

let idCounter = 0;
export function createSystem<T extends ActorSystemInfo>(
  rootActor: AnyActorRef
): ActorSystem<T> {
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();
  const observers = new Set<Observer<InspectionEvent>>();

  const system: ActorSystem<T> = {
    _bookId: () => `x:${idCounter++}`,
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
      const resolvedInspectionEvent: InspectionEvent = {
        ...event,
        rootId: rootActor.sessionId
      };
      observers.forEach((observer) => observer.next?.(resolvedInspectionEvent));
    },
    _relay: (source, target, event) => {
      system._sendInspectionEvent({
        type: '@xstate.event',
        sourceRef: source,
        actorRef: target,
        event
      });

      target._send(event);
    }
  };

  return system;
}
export interface BaseInspectionEventProperties {
  rootId: string; // the session ID of the root
  /**
   * The relevant actorRef for the inspection event.
   * - For snapshot events, this is the `actorRef` of the snapshot.
   * - For event events, this is the target `actorRef` (recipient of event).
   * - For actor events, this is the `actorRef` of the registered actor.
   */
  actorRef: AnyActorRef;
}

export interface InspectedSnapshotEvent extends BaseInspectionEventProperties {
  type: '@xstate.snapshot';
  event: AnyEventObject; // { type: string, ... }
  snapshot: Snapshot<unknown>;
}

export interface InspectedEventEvent extends BaseInspectionEventProperties {
  type: '@xstate.event';
  // The source might not exist, e.g. when:
  // - root init events
  // - events sent from external (non-actor) sources
  sourceRef: AnyActorRef | undefined;
  event: AnyEventObject; // { type: string, ... }
}

export interface InspectedActorEvent extends BaseInspectionEventProperties {
  type: '@xstate.actor';
}

export type InspectionEvent =
  | InspectedSnapshotEvent
  | InspectedEventEvent
  | InspectedActorEvent;
