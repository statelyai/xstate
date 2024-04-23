import { InspectionEvent } from './inspection.ts';
import {
  AnyEventObject,
  ActorSystemInfo,
  AnyActorRef,
  Observer,
  Snapshot,
  Subscribable,
  HomomorphicOmit,
  EventObject,
  AnyTransitionDefinition
} from './types.ts';
import { toObserver } from './utils.ts';

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
    target: AnyActorRef,
    event: EventObject,
    delay: number,
    id: string | undefined
  ): void;
  cancel(source: AnyActorRef, id: string): void;
  cancelAll(actorRef: AnyActorRef): void;
}

export interface SystemSnapshot {
  _scheduledEvents: Record<ScheduledEventId, ScheduledEvent>;
  actors: Record<string, AnyActorRef>;
}

type ScheduledEventId = string & { __scheduledEventId: never };

function createScheduledEventId(
  actorRef: AnyActorRef,
  id: string
): ScheduledEventId {
  return `${actorRef.sessionId}.${id}` as ScheduledEventId;
}

export interface ActorSystem<T extends ActorSystemInfo>
  extends Subscribable<SystemSnapshot> {
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
  getSnapshot: () => SystemSnapshot;
  /**
   * @internal
   */
  _updateSnapshot: (snapshot: SystemSnapshot) => void;
  /**
   * @internal
   */
  _snapshot: SystemSnapshot;
  start: () => void;
  _clock: Clock;
  _logger: (...args: any[]) => void;
}

export type AnyActorSystem = ActorSystem<any>;

let idCounter = 0;
export function createSystem<T extends ActorSystemInfo>(
  rootActor: AnyActorRef,
  options: {
    clock: Clock;
    logger: (...args: any[]) => void;
    snapshot?: unknown;
  }
): ActorSystem<T> {
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();
  const inspectionObservers = new Set<Observer<InspectionEvent>>();
  const systemObservers = new Set<Observer<SystemSnapshot>>();
  const timerMap: { [id: ScheduledEventId]: number } = {};
  const { clock, logger } = options;

  const scheduler: Scheduler = {
    schedule: (
      source,
      target,
      event,
      delay,
      id = Math.random().toString(36).slice(2)
    ) => {
      const scheduledEvent: ScheduledEvent = {
        source,
        target,
        event,
        delay,
        id,
        startedAt: Date.now()
      };
      const scheduledEventId = createScheduledEventId(source, id);
      const snapshot = system.getSnapshot();
      system._updateSnapshot({
        _scheduledEvents: {
          ...snapshot._scheduledEvents,
          [scheduledEventId]: scheduledEvent
        },
        actors: { ...snapshot.actors }
      });

      const timeout = clock.setTimeout(() => {
        delete timerMap[scheduledEventId];
        const {
          _scheduledEvents: { [scheduledEventId]: _, ..._scheduledEvents },
          actors
        } = system.getSnapshot();
        system._updateSnapshot({
          _scheduledEvents: {
            ..._scheduledEvents
          },
          actors: { ...snapshot.actors }
        });

        system._relay(source, target, event);
      }, delay);

      timerMap[scheduledEventId] = timeout;
    },
    cancel: (source, id: string) => {
      const scheduledEventId = createScheduledEventId(source, id);
      const timeout = timerMap[scheduledEventId];

      delete timerMap[scheduledEventId];
      const {
        _scheduledEvents: { [scheduledEventId]: _, ..._scheduledEvents },
        actors
      } = system.getSnapshot();
      system._updateSnapshot({
        _scheduledEvents: {
          ..._scheduledEvents
        },
        actors: { ...actors }
      });

      clock.clearTimeout(timeout);
    },
    cancelAll: (actorRef) => {
      for (const scheduledEventId in system._snapshot._scheduledEvents) {
        const scheduledEvent =
          system._snapshot._scheduledEvents[
            scheduledEventId as ScheduledEventId
          ];
        if (scheduledEvent.source === actorRef) {
          scheduler.cancel(actorRef, scheduledEvent.id);
        }
      }
    }
  };
  const sendInspectionEvent = (event: InspectionEvent) => {
    if (!inspectionObservers.size) {
      return;
    }
    const resolvedInspectionEvent: InspectionEvent = {
      ...event,
      rootId: rootActor.sessionId
    };
    inspectionObservers.forEach(
      (observer) => observer.next?.(resolvedInspectionEvent)
    );
  };

  const system: ActorSystem<T> = {
    _snapshot: {
      _scheduledEvents:
        (options?.snapshot && (options.snapshot as any).scheduler) ?? {},
      actors: {}
    },

    _bookId: () => `x:${idCounter++}`,
    _register: (sessionId, actorRef) => {
      children.set(sessionId, actorRef);
      const systemId = reverseKeyedActors.get(actorRef);
      if (systemId !== undefined) {
        const currentSnapshot = system.getSnapshot();
        if (currentSnapshot.actors[systemId as any] !== actorRef) {
          system._updateSnapshot({
            _scheduledEvents: { ...currentSnapshot._scheduledEvents },
            actors: {
              ...currentSnapshot.actors,
              [systemId]: actorRef
            }
          });
        }
      }
      return sessionId;
    },
    _unregister: (actorRef) => {
      children.delete(actorRef.sessionId);
      const systemId = reverseKeyedActors.get(actorRef);

      if (systemId !== undefined) {
        keyedActors.delete(systemId);
        reverseKeyedActors.delete(actorRef);
        const {
          _scheduledEvents,
          actors: { [systemId]: _, ...actors }
        } = system.getSnapshot();
        system._updateSnapshot({
          _scheduledEvents: { ..._scheduledEvents },
          actors
        });
      }
    },
    get: (systemId) => {
      return keyedActors.get(systemId) as T['actors'][any];
    },
    subscribe: (
      nextListenerOrObserver:
        | ((event: SystemSnapshot) => void)
        | Observer<SystemSnapshot>,
      errorListener?: (error: any) => void,
      completeListener?: () => void
    ) => {
      const observer = toObserver(
        nextListenerOrObserver,
        errorListener,
        completeListener
      );

      systemObservers.add(observer);

      return {
        unsubscribe: () => {
          systemObservers.delete(observer);
        }
      };
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
      const currentSnapshot = system.getSnapshot();
      if (currentSnapshot.actors[systemId as any] !== actorRef) {
        system._updateSnapshot({
          _scheduledEvents: { ...system._snapshot._scheduledEvents },
          actors: {
            ...system._snapshot.actors,
            [systemId]: actorRef
          }
        });
      }
    },
    inspect: (observer) => {
      inspectionObservers.add(observer);
    },
    _sendInspectionEvent: sendInspectionEvent as any,
    _relay: (source, target, event) => {
      system._sendInspectionEvent({
        type: '@xstate.event',
        sourceRef: source,
        actorRef: target,
        event
      });

      target._send(event);
    },
    scheduler,
    getSnapshot: () => {
      return {
        _scheduledEvents: { ...system._snapshot._scheduledEvents },
        actors: { ...system._snapshot.actors }
      };
    },
    _updateSnapshot: (snapshot) => {
      system._snapshot = snapshot;
      systemObservers.forEach((listener) => {
        listener.next?.(snapshot);
      });
    },
    start: () => {
      const { _scheduledEvents } = system.getSnapshot();
      system._updateSnapshot({
        _scheduledEvents: {},
        actors: { ...system._snapshot.actors }
      });
      for (const scheduledId in _scheduledEvents) {
        const { source, target, event, delay, id } =
          _scheduledEvents[scheduledId as ScheduledEventId];
        scheduler.schedule(source, target, event, delay, id);
      }
    },
    _clock: clock,
    _logger: logger
  };

  return system;
}
