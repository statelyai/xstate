import { InspectionEvent } from './inspection.ts';
import {
  AnyEventObject,
  ActorTermination,
  ActorSystemInfo,
  AnyActor,
  Observer,
  HomomorphicOmit,
  EventObject,
  Subscription,
  AnyActorLogic,
  ActorOptions
} from './types.ts';
import { XSTATE_TIMER } from './constants.ts';
import { toObserver } from './utils.ts';

interface ScheduledTimer {
  id: string;
  scheduledAt: number;
  dueAt: number;
  delay: number;
  source: AnyActor;
}

export interface Clock {
  setTimeout(fn: (...args: any[]) => void, timeout: number): any;
  clearTimeout(id: any): void;
}

interface Scheduler {
  schedule(source: AnyActor, id: string, delay: number): void;
  cancel(source: AnyActor, id: string): void;
  cancelAll(actor: AnyActor): void;
}

/**
 * Runtime operations used to execute effects.
 *
 * An external interpreter can override these operations while the default actor
 * system provides the local in-memory implementation.
 */
export interface ActorSystemRuntime {
  /** Publishes a newly created actor to the runtime. */
  spawnActor(
    source: AnyActor | undefined,
    actor: AnyActor
  ): void | PromiseLike<void>;
  /** Starts an actor. */
  startActor(actor: AnyActor): void | PromiseLike<void>;
  /** Stops an actor without producing a completion result. */
  stopActor(actor: AnyActor): void | PromiseLike<void>;
  /** Completes or errors an actor and publishes its terminal result. */
  terminateActor(
    actor: AnyActor,
    termination: ActorTermination
  ): void | PromiseLike<void>;
  /** Delivers an event between actors. */
  sendEvent(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ): void | PromiseLike<void>;
  /** Publishes an emitted event. */
  emitEvent(source: AnyActor, event: EventObject): void | PromiseLike<void>;
  /** Schedules a logical timer. */
  scheduleTimer(
    source: AnyActor,
    id: string,
    delay: number
  ): void | PromiseLike<void>;
  /** Cancels one logical timer. */
  cancelTimer(source: AnyActor, id: string): void | PromiseLike<void>;
  /** Cancels all logical timers owned by an actor. */
  cancelAllTimers(source: AnyActor): void | PromiseLike<void>;
}

type ScheduledTimerId = string & { __scheduledTimerId: never };

function createScheduledTimerId(actor: AnyActor, id: string): ScheduledTimerId {
  return `${actor.sessionId}.${id}` as ScheduledTimerId;
}

export interface ActorSystem<T extends ActorSystemInfo>
  extends ActorSystemRuntime {
  /** @internal Allocates an actor reference during snapshot calculation. */
  createActorRef(
    logic: AnyActorLogic,
    options: ActorOptions<AnyActorLogic>
  ): AnyActor;
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
    _scheduledTimers: Record<string, ScheduledTimer>;
  };
  /** @internal */
  _snapshot: {
    _scheduledTimers: Record<ScheduledTimerId, ScheduledTimer>;
    _nextActorId: number;
  };
  start: () => void;
  _clock: Clock;
  _logger: (...args: any[]) => void;
}

export type AnyActorSystem = ActorSystem<any>;

export function createRuntimeSystem<T extends ActorSystemInfo>(
  rootActor: AnyActor,
  options: {
    clock: Clock;
    logger: (...args: any[]) => void;
    snapshot?: unknown;
    createActorRef: ActorSystem<T>['createActorRef'];
  }
): ActorSystem<T> {
  const children = new Map<string, AnyActor>();
  const keyedActors = new Map<keyof T['actors'], AnyActor | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActor, keyof T['actors']>();
  const inspectionObservers = new Set<Observer<InspectionEvent>>();
  const timerMap: { [id: ScheduledTimerId]: number } = {};
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
    schedule: (source, id, delay) => {
      const existingId = createScheduledTimerId(source, id);
      if (timerMap[existingId] !== undefined) {
        scheduler.cancel(source, id);
      }

      const timer = source.getSnapshot()?.timers?.[id];
      if (timer) {
        const target = timer.target === 'self' ? source : timer.target;
        recordSent(source, target, timer.event, delay, id);
      }

      const scheduledAt = Date.now();
      const scheduledTimer: ScheduledTimer = {
        source,
        delay,
        id,
        scheduledAt,
        dueAt: scheduledAt + delay
      };
      const scheduledTimerId = createScheduledTimerId(source, id);
      system._snapshot._scheduledTimers[scheduledTimerId] = scheduledTimer;

      const timeout = clock.setTimeout(() => {
        delete timerMap[scheduledTimerId];
        delete system._snapshot._scheduledTimers[scheduledTimerId];

        deliver(source, source, { type: XSTATE_TIMER, id });
      }, delay);

      timerMap[scheduledTimerId] = timeout;
    },
    cancel: (source, id: string) => {
      const scheduledTimerId = createScheduledTimerId(source, id);
      const timeout = timerMap[scheduledTimerId];

      delete timerMap[scheduledTimerId];
      delete system._snapshot._scheduledTimers[scheduledTimerId];

      if (timeout !== undefined) {
        clock.clearTimeout(timeout);
      }
    },
    cancelAll: (actor) => {
      for (const scheduledTimerId in system._snapshot._scheduledTimers) {
        const scheduledTimer =
          system._snapshot._scheduledTimers[
            scheduledTimerId as ScheduledTimerId
          ];
        if (scheduledTimer.source === actor) {
          scheduler.cancel(actor, scheduledTimer.id);
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
      _scheduledTimers:
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
    createActorRef: options.createActorRef,
    spawnActor: () => {},
    startActor: (actor: AnyActor) => {
      actor.start();
    },
    stopActor: (actor: AnyActor) => {
      (actor as AnyActor & { _stop(): void })._stop();
    },
    terminateActor: (actor, termination) => {
      (
        actor as AnyActor & {
          _terminate(termination: ActorTermination): void;
        }
      )._terminate(termination);
    },
    sendEvent: (source, target, event) => {
      recordSent(source, target, event);
      deliver(source, target, event);
    },
    emitEvent: (source, event) =>
      (source as AnyActor & { _emit(event: EventObject): void })._emit(event),
    scheduleTimer: (source, id, delay) => scheduler.schedule(source, id, delay),
    cancelTimer: (source, id) => scheduler.cancel(source, id),
    cancelAllTimers: (source) => scheduler.cancelAll(source),
    _relay: (source, target, event) => system.sendEvent(source, target, event),
    scheduler,
    getSnapshot: () => {
      return {
        _scheduledTimers: { ...system._snapshot._scheduledTimers }
      };
    },
    start: () => {
      const scheduledTimers = system._snapshot._scheduledTimers;
      system._snapshot._scheduledTimers = {};
      for (const scheduledId in scheduledTimers) {
        const { source, dueAt, id } =
          scheduledTimers[scheduledId as ScheduledTimerId];
        system.scheduleTimer(source, id, Math.max(0, dueAt - Date.now()));
      }
    },
    _clock: clock,
    _logger: logger
  };

  return system;
}
