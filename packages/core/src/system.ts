import type { InspectionEvent, SentRecord } from './inspection.ts';
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
import { markSystemSnapshotDirty } from './snapshotActorRef.ts';

interface ScheduledTimer {
  id: string;
  scheduledAt: number;
  dueAt: number;
  delay: number;
  source: AnyActor;
}

export interface Clock {
  /** Returns the clock's current time in milliseconds. */
  now?(): number;
  setTimeout(fn: (...args: any[]) => void, timeout: number): any;
  clearTimeout(id: any): void;
}

interface Scheduler {
  schedule(source: AnyActor, id: string, delay: number): void;
  cancel(source: AnyActor, id: string): void;
  cancelAll(actor: AnyActor): void;
}

let nextFallbackSystemId = 0;

function createSystemId(): string {
  let crypto: Crypto | undefined;
  try {
    crypto = globalThis.crypto;
  } catch {
    // Use the process-local fallback below.
  }

  if (crypto?.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Try getRandomValues next.
    }
  }

  if (crypto?.getRandomValues) {
    try {
      const values = new Uint32Array(4);
      crypto.getRandomValues(values);
      return Array.from(values, (value) => value.toString(36)).join('-');
    } catch {
      // Use the process-local fallback below.
    }
  }

  return `xstate-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}-${nextFallbackSystemId++}`;
}

/** @internal */
export function resolveActorId(
  system: AnyActorSystem,
  requestedId: string | undefined
): string {
  if (requestedId !== undefined) {
    const match = /^x:(\d+)$/.exec(requestedId);
    const reservedId = match ? Number(match[1]) : undefined;
    if (reservedId !== undefined && Number.isSafeInteger(reservedId)) {
      const nextActorId = Math.max(
        system._snapshot._nextActorId,
        reservedId + 1
      );
      if (nextActorId !== system._snapshot._nextActorId) {
        system._snapshot._nextActorId = nextActorId;
        markSystemSnapshotDirty(system);
      }
    }
    return requestedId;
  }

  const id = `x:${system._snapshot._nextActorId++}`;
  markSystemSnapshotDirty(system);
  return id;
}

/** @internal */
export function bookSessionId(system: AnyActorSystem): string {
  return `${system._identity.systemId}:${system._identity.nextSessionId++}`;
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

export interface ActorSystem<
  T extends ActorSystemInfo
> extends ActorSystemRuntime {
  /** @internal Allocates an actor reference during snapshot calculation. */
  createActorRef(
    logic: AnyActorLogic,
    options: ActorOptions<AnyActorLogic>
  ): AnyActor;
  /** @internal */
  children: Map<string, AnyActor>;
  /** @internal Avoids materializing the registered-actor map. */
  _getRootActor?: () => AnyActor | undefined;
  /** @internal Avoids materializing the registered-actor map. */
  _peekChildren?: () => Map<string, AnyActor> | undefined;
  /** @internal */
  reverseKeyedActors: WeakMap<AnyActor, keyof T['actors']>;
  /** @internal */
  keyedActors: Map<keyof T['actors'], AnyActor | undefined>;
  /** @internal */
  _peekKeyedActors?: () =>
    | Map<keyof T['actors'], AnyActor | undefined>
    | undefined;
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
  /** @internal Avoids collecting inspection-only transition metadata. */
  _hasInspectionObservers?: () => boolean;
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
  /**
   * Runtime identity shared by every snapshot view of this actor system.
   *
   * @internal
   */
  _identity: {
    systemId: string;
    nextSessionId: number;
  };
  /** @internal */
  _snapshot: {
    _scheduledTimers: Record<ScheduledTimerId, ScheduledTimer>;
    _nextActorId: number;
  };
  /** @internal */
  _snapshotVersion: number;
  start: () => void;
  _clock: Clock;
  _logger: (...args: any[]) => void;
}

export type AnyActorSystem = ActorSystem<any>;

class RuntimeSystem<T extends ActorSystemInfo> implements ActorSystem<T> {
  private _children?: Map<string, AnyActor>;
  private _keyedActors?: Map<keyof T['actors'], AnyActor | undefined>;
  private _reverseKeyedActors?: WeakMap<AnyActor, keyof T['actors']>;
  public _identity = {
    systemId: createSystemId(),
    nextSessionId: 0
  };
  public _snapshot: ActorSystem<T>['_snapshot'];
  public _snapshotVersion = 0;
  public scheduler: Scheduler = this;
  public _clock: Clock;
  public _logger: (...args: any[]) => void;
  public createActorRef: ActorSystem<T>['createActorRef'];

  private _inspectionObservers?: Set<Observer<InspectionEvent>>;
  private _timerMap?: { [id: ScheduledTimerId]: number };

  public get children(): Map<string, AnyActor> {
    const children = (this._children ??= new Map());
    if (this._getRootActor()) {
      children.set(this._rootActor.sessionId, this._rootActor);
    }
    return children;
  }

  public set children(children: Map<string, AnyActor>) {
    this._children = children;
  }

  public _getRootActor(): AnyActor | undefined {
    return this._rootActor._isRunning() ? this._rootActor : undefined;
  }

  public _peekChildren(): Map<string, AnyActor> | undefined {
    return this._children;
  }

  public get keyedActors(): Map<keyof T['actors'], AnyActor | undefined> {
    return (this._keyedActors ??= new Map());
  }

  public set keyedActors(actors: Map<keyof T['actors'], AnyActor | undefined>) {
    this._keyedActors = actors;
  }

  public get reverseKeyedActors(): WeakMap<AnyActor, keyof T['actors']> {
    return (this._reverseKeyedActors ??= new WeakMap());
  }

  public set reverseKeyedActors(actors: WeakMap<AnyActor, keyof T['actors']>) {
    this._reverseKeyedActors = actors;
  }

  /** @internal Avoids materializing the receptionist for empty systems. */
  public _peekKeyedActors():
    | Map<keyof T['actors'], AnyActor | undefined>
    | undefined {
    return this._keyedActors;
  }

  constructor(
    private _rootActor: AnyActor,
    options: {
      clock: Clock;
      logger: (...args: any[]) => void;
      snapshot?: unknown;
      createActorRef: ActorSystem<T>['createActorRef'];
    }
  ) {
    const restoredSnapshot =
      typeof options.snapshot === 'object' && options.snapshot !== null
        ? (options.snapshot as {
            scheduler?: Record<ScheduledTimerId, ScheduledTimer>;
            _nextActorId?: number;
          })
        : undefined;
    this._clock = options.clock;
    this._logger = options.logger;
    this.createActorRef = options.createActorRef;
    this._snapshot = {
      _scheduledTimers: restoredSnapshot?.scheduler ?? {},
      _nextActorId: restoredSnapshot?._nextActorId ?? 0
    };
  }

  // Records a send on the *sender's* transition for the `sent[]` inspection
  // facet. Captures the send when it is initiated (including delayed sends that
  // may never deliver), keyed to the source actor's in-flight transition.
  private _recordSent(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject,
    delay?: number,
    id?: string
  ): void {
    if (!this._inspectionObservers?.size || !source) {
      return;
    }
    const inspectionSource = source as AnyActor & {
      _collectedSent?: SentRecord[];
    };
    const collected = (inspectionSource._collectedSent ??= []);
    collected.push({
      targetRef: target,
      targetId: target.id,
      event,
      delay,
      id
    });
  }

  public schedule(source: AnyActor, id: string, delay: number): void {
    const existingId = createScheduledTimerId(source, id);
    if (this._timerMap?.[existingId] !== undefined) {
      this.cancel(source, id);
    }

    const timer = source.getSnapshot()?.timers?.[id];
    if (timer) {
      const target = timer.target === 'self' ? source : timer.target;
      this._recordSent(source, target, timer.event, delay, id);
    }

    const scheduledAt = this._clock.now?.() ?? Date.now();
    const scheduledTimer: ScheduledTimer = {
      source,
      delay,
      id,
      scheduledAt,
      dueAt: scheduledAt + delay
    };
    const scheduledTimerId = createScheduledTimerId(source, id);
    this._snapshot._scheduledTimers[scheduledTimerId] = scheduledTimer;
    markSystemSnapshotDirty(this);

    const timeout = this._clock.setTimeout(() => {
      if (this._timerMap) {
        delete this._timerMap[scheduledTimerId];
      }
      delete this._snapshot._scheduledTimers[scheduledTimerId];
      markSystemSnapshotDirty(this);

      this._deliver(source, source, { type: XSTATE_TIMER, id });
    }, delay);

    (this._timerMap ??= {})[scheduledTimerId] = timeout;
  }

  public cancel(source: AnyActor, id: string): void {
    const scheduledTimerId = createScheduledTimerId(source, id);
    const timeout = this._timerMap?.[scheduledTimerId];

    if (this._timerMap) {
      delete this._timerMap[scheduledTimerId];
    }
    delete this._snapshot._scheduledTimers[scheduledTimerId];
    markSystemSnapshotDirty(this);

    if (timeout !== undefined) {
      this._clock.clearTimeout(timeout);
    }
  }

  public cancelAll(actor: AnyActor): void {
    for (const scheduledTimerId in this._snapshot._scheduledTimers) {
      const scheduledTimer =
        this._snapshot._scheduledTimers[scheduledTimerId as ScheduledTimerId];
      if (scheduledTimer.source === actor) {
        this.cancel(actor, scheduledTimer.id);
      }
    }
  }

  // Delivers an event to the target actor. Used by both `_relay` (which also
  // records the send) and the scheduler's timer (which already recorded it).
  private _deliver(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ): void {
    const runtimeTarget = target as AnyActor & {
      logic?: { isInternalEventType?: (eventType: string) => boolean };
      _lastSourceRef?: AnyActor;
    };
    const targetMachine = runtimeTarget.logic;
    const isInternalEvent =
      typeof targetMachine?.isInternalEventType === 'function' &&
      targetMachine.isInternalEventType(event.type);

    if (isInternalEvent && source !== target) {
      throw new Error(
        `Internal event "${event.type}" cannot be sent to actor "${target.id}" from outside.`
      );
    }

    // remember the last source for unified transition inspect event
    runtimeTarget._lastSourceRef = source;
    target._send(event);
  }

  public _register(sessionId: string, actor: AnyActor): string {
    if (actor === this._rootActor) {
      this._children?.set(sessionId, actor);
    } else {
      (this._children ??= new Map()).set(sessionId, actor);
    }
    markSystemSnapshotDirty(this);
    return sessionId;
  }

  public _unregister(actor: AnyActor): void {
    let changed: boolean;
    if (actor === this._rootActor) {
      changed = this._getRootActor() !== undefined;
      changed = (this._children?.delete(actor.sessionId!) ?? false) || changed;
    } else {
      changed = this._children?.delete(actor.sessionId!) ?? false;
    }
    const registryKey = this._reverseKeyedActors?.get(actor);

    if (registryKey !== undefined) {
      if (this._keyedActors?.get(registryKey) === actor) {
        this._keyedActors.delete(registryKey);
        changed = true;
      }
      this._reverseKeyedActors?.delete(actor);
    }
    if (changed) {
      markSystemSnapshotDirty(this);
    }
  }

  public get<K extends keyof T['actors']>(
    registryKey: K
  ): T['actors'][K] | undefined {
    return this._keyedActors?.get(registryKey) as T['actors'][K] | undefined;
  }

  public getAll(): Partial<T['actors']> {
    return Object.fromEntries(this._keyedActors?.entries() ?? []) as Partial<
      T['actors']
    >;
  }

  public _set<K extends keyof T['actors']>(
    registryKey: K,
    actor: AnyActor
  ): void {
    const existing = this._keyedActors?.get(registryKey);
    if (existing && existing !== actor) {
      throw new Error(
        `Actor with registry key '${registryKey as string}' already exists.`
      );
    }

    (this._keyedActors ??= new Map()).set(registryKey, actor);
    (this._reverseKeyedActors ??= new WeakMap()).set(actor, registryKey);
    if (existing !== actor) {
      markSystemSnapshotDirty(this);
    }
  }

  public inspect(
    observerOrFn:
      | Observer<InspectionEvent>
      | ((inspectionEvent: InspectionEvent) => void)
  ): Subscription {
    const observer = toObserver(observerOrFn);
    (this._inspectionObservers ??= new Set()).add(observer);

    return {
      unsubscribe: () => {
        this._inspectionObservers?.delete(observer);
      }
    };
  }

  public _hasInspectionObservers(): boolean {
    return !!this._inspectionObservers?.size;
  }

  public _sendInspectionEvent(
    event: HomomorphicOmit<InspectionEvent, 'rootId'>
  ): void {
    if (!this._inspectionObservers?.size) {
      return;
    }
    const resolvedInspectionEvent: InspectionEvent = {
      ...event,
      rootId: this._rootActor.sessionId!
    };
    this._inspectionObservers.forEach((observer) =>
      observer.next?.(resolvedInspectionEvent)
    );
  }

  public spawnActor(): void {}

  public startActor(actor: AnyActor): void {
    actor.start();
  }

  public stopActor(actor: AnyActor): void {
    (actor as AnyActor & { _stop(): void })._stop();
  }

  public terminateActor(actor: AnyActor, termination: ActorTermination): void {
    (
      actor as AnyActor & { _terminate(value: ActorTermination): void }
    )._terminate(termination);
  }

  public sendEvent(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ): void {
    this._recordSent(source, target, event);
    this._deliver(source, target, event);
  }

  public emitEvent(source: AnyActor, event: EventObject): void {
    (source as AnyActor & { _emit(value: EventObject): void })._emit(event);
  }

  public scheduleTimer(source: AnyActor, id: string, delay: number): void {
    this.schedule(source, id, delay);
  }

  public cancelTimer(source: AnyActor, id: string): void {
    this.cancel(source, id);
  }

  public cancelAllTimers(source: AnyActor): void {
    this.cancelAll(source);
  }

  public _relay(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ): void {
    this.sendEvent(source, target, event);
  }

  public getSnapshot(): {
    _scheduledTimers: Record<string, ScheduledTimer>;
  } {
    return {
      _scheduledTimers: { ...this._snapshot._scheduledTimers }
    };
  }

  public start(): void {
    const scheduledTimers = this._snapshot._scheduledTimers;
    this._snapshot._scheduledTimers = {};
    for (const scheduledId in scheduledTimers) {
      const { source, dueAt, id } =
        scheduledTimers[scheduledId as ScheduledTimerId];
      this.scheduleTimer(
        source,
        id,
        Math.max(0, dueAt - (this._clock.now?.() ?? Date.now()))
      );
    }
  }
}

export function createRuntimeSystem<T extends ActorSystemInfo>(
  rootActor: AnyActor,
  options: {
    clock: Clock;
    logger: (...args: any[]) => void;
    snapshot?: unknown;
    createActorRef: ActorSystem<T>['createActorRef'];
  }
): ActorSystem<T> {
  return new RuntimeSystem(rootActor, options);
}
