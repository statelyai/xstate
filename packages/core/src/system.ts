import { InspectionEvent } from './inspection.ts';
import {
  AnyEventObject,
  ActorSystemInfo,
  AnyActor,
  Observer,
  HomomorphicOmit,
  EventObject,
  Subscription,
  TimersRestoreStrategy,
  AnyActorLogic,
  ActorOptions
} from './types.ts';
import { toObserver } from './utils.ts';

interface ScheduledEvent {
  id: string;
  event: EventObject;
  startedAt: number; // timestamp
  delay: number;
  source: AnyActor;
  target: AnyActor;
}

export interface Clock {
  setTimeout(fn: (...args: any[]) => void, timeout: number): any;
  clearTimeout(id: any): void;
}

interface Scheduler {
  schedule(
    source: AnyActor,
    target: AnyActor,
    event: EventObject,
    delay: number,
    id: string | undefined
  ): void;
  cancel(source: AnyActor, id: string): void;
  cancelAll(actor: AnyActor): void;
}

/**
 * Runtime operations used by an actor system to allocate actor references and
 * execute effects.
 *
 * An external interpreter can override these operations while the default actor
 * system provides the local in-memory implementation.
 */
export interface ActorSystemRuntime {
  /**
   * Allocates a reference for the next snapshot. This runs during transition
   * calculation and must not start or externally publish the actor.
   */
  createActorRef(
    logic: AnyActorLogic,
    options: ActorOptions<AnyActorLogic>
  ): AnyActor;
  spawnActor(
    source: AnyActor | undefined,
    actor: AnyActor
  ): void | PromiseLike<void>;
  startActor(actor: AnyActor): void | PromiseLike<void>;
  stopActor(actor: AnyActor): void | PromiseLike<void>;
  sendEvent(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ): void | PromiseLike<void>;
  emitEvent(source: AnyActor, event: EventObject): void | PromiseLike<void>;
  scheduleEvent(
    source: AnyActor,
    target: AnyActor,
    event: EventObject,
    delay: number,
    id: string | undefined
  ): void | PromiseLike<void>;
  cancelEvent(source: AnyActor, id: string): void | PromiseLike<void>;
  cancelAllEvents(source: AnyActor): void | PromiseLike<void>;
}

export interface ActorSystemRuntimeOptions {
  /** Overrides selected operations of the snapshot's actor system. */
  runtime?: Partial<ActorSystemRuntime>;
}

type ScheduledEventId = string & { __scheduledEventId: never };

function createScheduledEventId(actor: AnyActor, id: string): ScheduledEventId {
  return `${actor.sessionId}.${id}` as ScheduledEventId;
}

export interface ActorSystem<T extends ActorSystemInfo>
  extends ActorSystemRuntime {
  /** @internal */
  children: Map<string, AnyActor>;
  /** @internal */
  reverseKeyedActors: WeakMap<AnyActor, keyof T['actors']>;
  /** @internal */
  keyedActors: Map<keyof T['actors'], AnyActor | undefined>;
  /** @internal */
  _bookId: () => string;
  /** @internal */
  _register: (sessionId: string, actor: AnyActor) => string;
  /** @internal */
  _unregister: (actor: AnyActor) => void;
  /** @internal */
  _set: <K extends keyof T['actors']>(key: K, actor: AnyActor) => void;
  get: <K extends keyof T['actors']>(key: K) => T['actors'][K] | undefined;
  getAll: () => Partial<T['actors']>;

  inspect: (
    observer:
      | Observer<InspectionEvent>
      | ((inspectionEvent: InspectionEvent) => void)
  ) => Subscription;
  /** @internal */
  _sendInspectionEvent: (
    event: HomomorphicOmit<InspectionEvent, 'rootId'>
  ) => void;
  /** @internal */
  _relay: (
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ) => void | PromiseLike<void>;
  scheduler: Scheduler;
  getSnapshot: () => {
    _scheduledEvents: Record<string, ScheduledEvent>;
  };
  /** @internal */
  _snapshot: {
    _scheduledEvents: Record<ScheduledEventId, ScheduledEvent>;
    _nextActorId: number;
  };
  start: () => void;
  _clock: Clock;
  _logger: (...args: any[]) => void;
  /**
   * How rehydrated actors in this system restore persisted timers.
   *
   * @internal
   */
  _timerStrategy?: TimersRestoreStrategy;
}

export type AnyActorSystem = ActorSystem<any>;

export function createRuntimeSystem<T extends ActorSystemInfo>(
  rootActor: AnyActor,
  options: {
    clock: Clock;
    logger: (...args: any[]) => void;
    snapshot?: unknown;
    timers?: TimersRestoreStrategy;
    runtime?: Partial<ActorSystemRuntime>;
    createActorRef: ActorSystemRuntime['createActorRef'];
  }
): ActorSystem<T> {
  const children = new Map<string, AnyActor>();
  const keyedActors = new Map<keyof T['actors'], AnyActor | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActor, keyof T['actors']>();
  const inspectionObservers = new Set<Observer<InspectionEvent>>();
  const timerMap: { [id: ScheduledEventId]: number } = {};
  const { clock, logger } = options;

  // Records a send on the *sender's* transition for the `sent[]` inspection
  // facet. Captures the send when it is initiated (including delayed sends that
  // may never deliver), keyed to the source actor's in-flight transition.
  const recordSent = (
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject,
    delay?: number,
    id?: string
  ) => {
    if (!inspectionObservers.size || !source) {
      return;
    }
    const collected = ((source as any)._collectedSent ??= []);
    collected.push({
      targetRef: target,
      targetId: target.id,
      event,
      delay,
      id
    });
  };

  const scheduler: Scheduler = {
    schedule: (
      source,
      target,
      event,
      delay,
      id = Math.random().toString(36).slice(2)
    ) => {
      recordSent(source, target, event, delay, id);
      const scheduledEvent: ScheduledEvent = {
        source,
        target,
        event,
        delay,
        id,
        startedAt: Date.now()
      };
      const scheduledEventId = createScheduledEventId(source, id);
      system._snapshot._scheduledEvents[scheduledEventId] = scheduledEvent;

      const timeout = clock.setTimeout(() => {
        delete timerMap[scheduledEventId];
        delete system._snapshot._scheduledEvents[scheduledEventId];

        // The send was already recorded at schedule time on the sender's
        // transition, so deliver without re-recording.
        void system.sendEvent(source, target, event);
      }, delay);

      timerMap[scheduledEventId] = timeout;
    },
    cancel: (source, id: string) => {
      const scheduledEventId = createScheduledEventId(source, id);
      const timeout = timerMap[scheduledEventId];

      delete timerMap[scheduledEventId];
      delete system._snapshot._scheduledEvents[scheduledEventId];

      if (timeout !== undefined) {
        clock.clearTimeout(timeout);
      }
    },
    cancelAll: (actor) => {
      for (const scheduledEventId in system._snapshot._scheduledEvents) {
        const scheduledEvent =
          system._snapshot._scheduledEvents[
            scheduledEventId as ScheduledEventId
          ];
        if (scheduledEvent.source === actor) {
          scheduler.cancel(actor, scheduledEvent.id);
        }
      }
    }
  };
  // Delivers an event to the target actor. Used by both `_relay` (which also
  // records the send) and the scheduler's timer (which already recorded it).
  const deliver = (
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ) => {
    const targetMachine = (target as any).logic;
    const isInternalEvent =
      typeof targetMachine?.isInternalEventType === 'function' &&
      targetMachine.isInternalEventType(event.type);

    if (isInternalEvent && source !== target) {
      throw new Error(
        `Internal event "${event.type}" cannot be sent to actor "${target.id}" from outside.`
      );
    }

    // remember the last source for unified transition inspect event
    (target as any)._lastSourceRef = source;
    target._send(event);
  };

  const sendInspectionEvent = (event: InspectionEvent) => {
    if (!inspectionObservers.size) {
      return;
    }
    const resolvedInspectionEvent: InspectionEvent = {
      ...event,
      rootId: rootActor.sessionId!
    };
    inspectionObservers.forEach((observer) =>
      observer.next?.(resolvedInspectionEvent)
    );
  };

  const system: ActorSystem<T> = {
    children,
    reverseKeyedActors,
    keyedActors,
    _snapshot: {
      _scheduledEvents:
        (options?.snapshot && (options.snapshot as any).scheduler) ?? {},
      _nextActorId: 0
    },
    _bookId: () => `x:${system._snapshot._nextActorId++}`,
    _register: (sessionId, actor) => {
      children.set(sessionId, actor);
      return sessionId;
    },
    _unregister: (actor) => {
      children.delete(actor.sessionId!);
      const registryKey = reverseKeyedActors.get(actor);

      if (registryKey !== undefined) {
        if (keyedActors.get(registryKey) === actor) {
          keyedActors.delete(registryKey);
        }
        reverseKeyedActors.delete(actor);
      }
    },
    get: (registryKey) => {
      return keyedActors.get(registryKey) as T['actors'][any] | undefined;
    },
    getAll: () => {
      return Object.fromEntries(keyedActors.entries()) as Partial<T['actors']>;
    },
    _set: (registryKey, actor) => {
      const existing = keyedActors.get(registryKey);
      if (existing && existing !== actor) {
        throw new Error(
          `Actor with registry key '${registryKey as string}' already exists.`
        );
      }

      keyedActors.set(registryKey, actor);
      reverseKeyedActors.set(actor, registryKey);
    },
    inspect: (observerOrFn) => {
      const observer = toObserver(observerOrFn);
      inspectionObservers.add(observer);

      return {
        unsubscribe() {
          inspectionObservers.delete(observer);
        }
      };
    },
    _sendInspectionEvent: sendInspectionEvent as any,
    createActorRef: options.runtime?.createActorRef ?? options.createActorRef,
    spawnActor: options.runtime?.spawnActor ?? (() => {}),
    startActor:
      options.runtime?.startActor ??
      ((actor: AnyActor) => {
        actor.start();
      }),
    stopActor:
      options.runtime?.stopActor ??
      ((actor: AnyActor) => {
        (actor as AnyActor & { _stop(): void })._stop();
      }),
    sendEvent: options.runtime?.sendEvent ?? deliver,
    emitEvent:
      options.runtime?.emitEvent ??
      ((source, event) =>
        (source as AnyActor & { _emit(event: EventObject): void })._emit(
          event
        )),
    scheduleEvent:
      options.runtime?.scheduleEvent ??
      ((source, target, event, delay, id) =>
        scheduler.schedule(source, target, event, delay, id)),
    cancelEvent:
      options.runtime?.cancelEvent ??
      ((source, id) => scheduler.cancel(source, id)),
    cancelAllEvents:
      options.runtime?.cancelAllEvents ??
      ((source) => scheduler.cancelAll(source)),
    _relay: (source, target, event) => {
      recordSent(source, target, event);
      return system.sendEvent(source, target, event);
    },
    scheduler,
    getSnapshot: () => {
      return {
        _scheduledEvents: { ...system._snapshot._scheduledEvents }
      };
    },
    start: () => {
      const scheduledEvents = system._snapshot._scheduledEvents;
      system._snapshot._scheduledEvents = {};
      for (const scheduledId in scheduledEvents) {
        const { source, target, event, delay, id } =
          scheduledEvents[scheduledId as ScheduledEventId];
        system.scheduleEvent(source, target, event, delay, id);
      }
    },
    _clock: clock,
    _logger: logger,
    _timerStrategy: options.timers
  };

  return system;
}
