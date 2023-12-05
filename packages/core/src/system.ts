import {
  AnyEventObject,
  ActorSystemInfo,
  AnyActorRef,
  Observer,
  Snapshot,
  HomomorphicOmit,
  EventObject
} from './types.ts';

export interface ScheduledEvent {
  id: string;
  event: EventObject;
  startedAt: number; // timestamp
  delay: number;
  source: AnyActorRef;
  target: AnyActorRef;
}

export interface Clock {
  setTimeout(fn: (...args: any[]) => void, timeout: number): any;
  clearTimeout(id: any): void;
}

export interface Scheduler {
  schedule(
    source: AnyActorRef,
    data: {
      id: string | undefined;
      event: EventObject;
      delay: number;
      to?: AnyActorRef;
    }
  ): void;
  cancel(id: string): void;
  cancelAll(actorRef: AnyActorRef): void;
}

export interface ActorSystem<T extends ActorSystemInfo> {
  /**
   * @internal
   */
  _bookId: () => string;
  /**
   * @internal
   */
  _register: (sessionId: string, actorRef: AnyActorRef) => string;
  /**
   * @internal
   */
  _unregister: (actorRef: AnyActorRef) => void;
  /**
   * @internal
   */
  _set: <K extends keyof T['actors']>(key: K, actorRef: T['actors'][K]) => void;
  get: <K extends keyof T['actors']>(key: K) => T['actors'][K] | undefined;
  inspect: (observer: Observer<InspectionEvent>) => void;
  /**
   * @internal
   */
  _sendInspectionEvent: (
    event: HomomorphicOmit<InspectionEvent, 'rootId'>
  ) => void;
  /**
   * @internal
   */
  _relay: (
    source: AnyActorRef | undefined,
    target: AnyActorRef,
    event: AnyEventObject
  ) => void;
  scheduler: Scheduler;
  getSnapshot: () => {
    _scheduledEvents: Record<string, ScheduledEvent>;
  };
  /**
   * @internal
   */
  _snapshot: {
    _scheduledEvents: Record<string, ScheduledEvent>;
  };
  start: () => void;
}

export type AnyActorSystem = ActorSystem<any>;

let idCounter = 0;
export function createSystem<T extends ActorSystemInfo>(
  rootActor: AnyActorRef,
  options: {
    clock: Clock;
    snapshot?: unknown;
  }
): ActorSystem<T> {
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();
  const observers = new Set<Observer<InspectionEvent>>();
  const timerMap: { [id: string]: number } = {};
  const clock = options.clock;

  const system: ActorSystem<T> = {
    _snapshot: {
      _scheduledEvents:
        (options?.snapshot && (options.snapshot as any).scheduler) ?? {}
    },
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
    },
    scheduler: {
      schedule: (source, data) => {
        // TODO: `id` has to be separated from `data.id` completely
        // `data.id` is supposed to be unique within an actor, `id` is supposed to be unique globally
        const id = data.id ?? Math.random().toString(36).slice(2);
        const scheduledEvent: ScheduledEvent = {
          ...data,
          id,
          source,
          target: data.to || source,
          startedAt: Date.now()
        };
        system._snapshot._scheduledEvents[id] = scheduledEvent;

        const timeout = clock.setTimeout(() => {
          const target = data.to || source;
          // TODO: explain this hack, it should also happen sooner, not within this timeout
          system._snapshot._scheduledEvents[id].target = target;
          delete system._snapshot._scheduledEvents[id];
          system._relay(source, target, data.event);
        }, data.delay);

        timerMap[id] = timeout;
      },
      cancel: (id: string) => {
        const timeout = timerMap[id];
        if (timeout !== undefined) {
          clock.clearTimeout(timeout);
        }
        delete timerMap[id];
        delete system._snapshot._scheduledEvents[id];
      },
      cancelAll: (actorRef) => {
        for (const id in system._snapshot._scheduledEvents) {
          if (system._snapshot._scheduledEvents[id].source === actorRef) {
            system.scheduler.cancel(id);
          }
        }
      }
    },
    getSnapshot: () => {
      return {
        _scheduledEvents: { ...system._snapshot._scheduledEvents }
      };
    },
    start: () => {
      for (const id in system._snapshot._scheduledEvents) {
        const scheduledEvent = system._snapshot._scheduledEvents[id];
        system.scheduler.schedule(scheduledEvent.source, scheduledEvent);
      }
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
