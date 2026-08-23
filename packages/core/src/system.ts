import isDevelopment from '#is-development';
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
import { getAmbientInspector } from './inspectionAmbient.ts';
import { markSystemSnapshotDirty } from './snapshotActorRef.ts';
import {
  assertEventCanBeSent,
  deliverEvent,
  stopActor as stopActorLocally,
  terminateActor as terminateActorLocally,
  runStep
} from './runtimeHelpers.ts';

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

let systemIdPrefix: string | undefined;
let nextSystemId = 0;

/** @internal */
export const transitionEffectSignal = new Error('Transition effect');
/** @internal */
export const transitionEffectTargets: AnyActor[] = [];

function createSystemIdPrefix(): string {
  let crypto: Crypto | undefined;
  try {
    crypto = globalThis.crypto;
  } catch {
    // Use the process-local fallback below.
  }

  if (crypto?.getRandomValues) {
    try {
      const values = new Uint32Array(4);
      crypto.getRandomValues(values);
      return Array.from(values, (value) =>
        value.toString(36).padStart(7, '0')
      ).join('');
    } catch {
      // Try randomUUID next.
    }
  }

  if (crypto?.randomUUID) {
    try {
      return crypto.randomUUID().replaceAll('-', '');
    } catch {
      // Use the process-local fallback below.
    }
  }

  return `xstate-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createSystemId(): string {
  systemIdPrefix ??= createSystemIdPrefix();
  return `${systemIdPrefix}:${(nextSystemId++).toString(36)}`;
}

/**
 * The identity a durable execution pins on every system its transitions
 * create. Shared across all transitions (and replays) of one execution, so
 * session ids become a deterministic function of actor-creation order:
 * `<executionId>:0`, `<executionId>:1`, … A replayed execution re-creates
 * the same session ids, so journaled completion events (which carry the
 * producing incarnation's `sessionId`) still match the children the replay
 * re-creates.
 */
export interface ExecutionIdentity {
  systemId: string;
  nextSessionId: number;
}

let ambientExecutionIdentity: ExecutionIdentity | undefined;

/** @internal Runs `fn` with systems it creates pinned to `identity`. */
export function withExecutionIdentity<T>(
  identity: ExecutionIdentity | undefined,
  fn: () => T
): T {
  if (!identity) {
    return fn();
  }
  const previous = ambientExecutionIdentity;
  ambientExecutionIdentity = identity;
  try {
    return fn();
  } finally {
    ambientExecutionIdentity = previous;
  }
}

export {
  hasAmbientInspector,
  withSystemInspector
} from './inspectionAmbient.ts';

/**
 * Derives the deterministic id prefix for a generated actor id from its actor
 * source: the registered source key when the source is a string, the logic's
 * own `id` otherwise, with `x` as the last-resort prefix.
 *
 * @internal
 */
export function getActorIdPrefix(
  src: string | AnyActorLogic | undefined
): string {
  if (typeof src === 'string') {
    return src;
  }
  const logicId = (src as { id?: unknown } | undefined)?.id;
  // Anonymous machines get the placeholder id '(machine)'; only named logic
  // earns a named id prefix.
  return typeof logicId === 'string' &&
    logicId.length &&
    logicId !== '(machine)'
    ? logicId
    : 'x';
}

/**
 * Encodes one actor id as an address segment. `/` separates segments, so it
 * is percent-encoded, and the escape character `%` is escaped first so the
 * encoding stays injective: the ids 'a/b' and 'a%2Fb' must not produce the
 * same address.
 *
 * @internal
 */
export function encodeAddressSegment(id: string): string {
  return id.includes('/') || id.includes('%')
    ? id.replaceAll('%', '%25').replaceAll('/', '%2F')
    : id;
}

/**
 * Parses a generated-shaped actor id (`prefix:<n>`). This single definition is
 * the determinism contract for id reservation: live allocation, replay, and
 * restore must all agree on what counts as generated-shaped. Deliberately
 * broader than ids a generated allocation could produce — over-reserving
 * skips numbers, which is harmless, while under-reserving could collide.
 *
 * @internal
 */
export function parseGeneratedActorId(
  id: string
): { prefix: string; index: number } | undefined {
  const separator = id.lastIndexOf(':');
  if (separator <= 0 || separator === id.length - 1) {
    return undefined;
  }
  const index = Number(id.slice(separator + 1));
  return Number.isSafeInteger(index) && index >= 0
    ? { prefix: id.slice(0, separator), index }
    : undefined;
}

/**
 * The id (and address root segment) of the first parentless actor of a logic:
 * the logic's own name, or `x:0` for anonymous logic.
 *
 * @internal
 */
export function getRootActorId(
  src: string | AnyActorLogic | undefined
): string {
  const prefix = getActorIdPrefix(src);
  return prefix === 'x' ? 'x:0' : prefix;
}

function getActorIdCounterKey(
  parent: AnyActor | undefined,
  prefix: string
): string {
  return `${parent ? parent.address : ''}|${prefix}`;
}

function bumpActorIdCounter(
  system: AnyActorSystem,
  counterKey: string,
  next: number
): void {
  const counters = system._snapshot._nextActorIds;
  if ((counters[counterKey] ?? 0) >= next) {
    return;
  }
  // Copy-on-write: snapshot systems share this record by shallow `_snapshot`
  // copies, so branches must not observe each other's allocations.
  system._snapshot._nextActorIds = { ...counters, [counterKey]: next };
  markSystemSnapshotDirty(system);
}

/** @internal */
export function resolveActorId(
  system: AnyActorSystem,
  requestedId: string | undefined,
  options?: {
    parent?: AnyActor;
    src?: string | AnyActorLogic;
  }
): string {
  if (requestedId !== undefined) {
    const generated = parseGeneratedActorId(requestedId);
    if (generated) {
      bumpActorIdCounter(
        system,
        getActorIdCounterKey(options?.parent, generated.prefix),
        generated.index + 1
      );
    } else if (!options?.parent) {
      // Reserve a restored root's bare name so a later parentless actor of
      // the same logic in this system numbers past it.
      bumpActorIdCounter(
        system,
        getActorIdCounterKey(undefined, requestedId),
        1
      );
    }
    return requestedId;
  }

  const prefix = getActorIdPrefix(options?.src);
  const counterKey = getActorIdCounterKey(options?.parent, prefix);
  const counter = system._snapshot._nextActorIds[counterKey] ?? 0;
  bumpActorIdCounter(system, counterKey, counter + 1);
  // The first parentless actor of a logic gets the logic's own name; later
  // parentless actors of the same logic in a shared system get numbered so
  // addresses stay unique.
  return !options?.parent && prefix !== 'x' && counter === 0
    ? prefix
    : `${prefix}:${counter}`;
}

/** @internal */
export function bookSessionId(system: AnyActorSystem): string {
  return `${system._identity.systemId}:${system._identity.nextSessionId++}`;
}

/**
 * Runtime operations used to execute effects.
 *
 * XState calculates pure transitions; a runtime executes their effects. The
 * built-in local runtime is one implementation at the same level as any
 * other: install a different one via `system.runtime` (for durable hosts,
 * through `createDurable`'s adapter runtime operations).
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
  /**
   * Runs an async actor's entire body as one durable unit. The actor is the
   * natural journal entry: its identity — `address`, string `src` key and
   * serializable `input` — crosses any boundary, so a host can wrap `exec`
   * in its own step primitive, or ignore `exec` entirely and re-run the
   * registered logic on a remote executor from `(src, input)` alone. The
   * default runs the body in this process, unjournaled.
   *
   * Like `runStep`, this is an orchestration frame: it may span external
   * events and must never be serialized behind other runtime operations.
   */
  runLogic(
    actor: AnyActor,
    exec: () => PromiseLike<unknown>
  ): PromiseLike<unknown>;
  /**
   * Runs one keyed step of an async actor (`enq.step`). The default journals
   * the result in the actor's own snapshot; a durable host implements this
   * to journal steps in its own journal instead — memoized results replay
   * without re-running `exec`.
   *
   * Unlike other runtime operations, a step is an orchestration frame that
   * may itself await runtime operations, so implementations must not
   * serialize it behind them.
   */
  runStep(
    actor: AnyActor,
    key: string,
    exec: () => unknown | PromiseLike<unknown>
  ): unknown | PromiseLike<unknown>;
  /**
   * Reports an undeliverable event. Delivery stays at-most-once — this is
   * observability, not retry: the default logs in development and emits an
   * inspection event.
   */
  deadLetter(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject,
    reason: string
  ): void | PromiseLike<void>;
  /** Cancels all logical timers owned by an actor. */
  cancelAllTimers(source: AnyActor): void | PromiseLike<void>;
}

/** @internal Every operation of `ActorSystemRuntime`, for runtime wrappers. */
export const RUNTIME_OPERATIONS = [
  'spawnActor',
  'startActor',
  'stopActor',
  'terminateActor',
  'emitEvent',
  'scheduleTimer',
  'cancelTimer',
  'cancelAllTimers',
  'deadLetter'
  // `runLogic`, `runStep` and `sendEvent` are deliberately absent: durable
  // executions wire them separately, since logic bodies and steps await
  // other runtime operations and root-addressed sends are captured per
  // batch.
] as const satisfies readonly (keyof ActorSystemRuntime)[];

type ScheduledTimerId = string & { __scheduledTimerId: never };

const emptyScheduledTimers = Object.freeze(
  {}
) as ActorSystem<any>['_snapshot']['_scheduledTimers'];

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
    /** Deterministic generated-id counters keyed by `${parentAddress}|${srcPrefix}`. */
    _nextActorIds: Record<string, number>;
  };
  /** @internal */
  _snapshotVersion: number;
  start: () => void;
  _clock: Clock;
  _logger: (...args: any[]) => void;
  /**
   * The runtime executing this system's effects. When unset, the built-in
   * local in-memory runtime runs them; `createActor(machine).start()` is just
   * that built-in runtime. A host runtime installed here applies to every
   * actor in the system — snapshot-scoped views and children created later
   * included — and may implement any subset of operations, with the rest
   * keeping the built-in behavior.
   *
   * An operation that returns a promise owns its own failure handling: the
   * paths that hand work to a runtime do not await it. `createDurable`
   * tracks its adapter's operations and fails `executeEffects` when one
   * rejects.
   *
   * Durable hosts should provide this through `createDurable`'s
   * adapter runtime operations rather than assigning it directly.
   */
  runtime?: Partial<ActorSystemRuntime>;
}

export type AnyActorSystem = ActorSystem<any>;

// These optional lazy fields intentionally have no emitted initializers.
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
interface RuntimeSystem<T extends ActorSystemInfo> {
  runtime?: Partial<ActorSystemRuntime>;
  _children?: Map<string, AnyActor>;
  _keyedActors?: Map<keyof T['actors'], AnyActor | undefined>;
  _reverseKeyedActors?: WeakMap<AnyActor, keyof T['actors']>;
  _inspectionObservers?: Set<Observer<InspectionEvent>>;
  _timerMap?: { [id: ScheduledTimerId]: number };
}

class RuntimeSystem<T extends ActorSystemInfo> implements ActorSystem<T> {
  public _identity = ambientExecutionIdentity ?? {
    systemId: createSystemId(),
    nextSessionId: 0
  };
  public _snapshot: ActorSystem<T>['_snapshot'];
  public _snapshotVersion = 0;
  public scheduler: Scheduler = this;
  public _clock: Clock;
  public _logger: (...args: any[]) => void;
  public createActorRef: ActorSystem<T>['createActorRef'];

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
          })
        : undefined;
    this._clock = options.clock;
    this._logger = options.logger;
    this.createActorRef = options.createActorRef;
    const ambientInspector = getAmbientInspector();
    if (ambientInspector) {
      this.inspect(ambientInspector);
    }
    this._snapshot = {
      _scheduledTimers: restoredSnapshot?.scheduler ?? emptyScheduledTimers,
      // System-level counters are process-local backstops; per-actor
      // counters persist on each machine snapshot, and restored explicit ids
      // reserve their numbering here via `resolveActorId`.
      _nextActorIds: {}
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
    if (this._snapshot._scheduledTimers === emptyScheduledTimers) {
      this._snapshot._scheduledTimers = {};
    }
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
    if (this._snapshot._scheduledTimers !== emptyScheduledTimers) {
      delete this._snapshot._scheduledTimers[scheduledTimerId];
    }
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
    deliverEvent(source, target, event);
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
    // Remote handles have no sessionId and are never in the session map;
    // their registry cleanup happens through the keyed-actor path below.
    if (actor === this._rootActor) {
      changed = this._getRootActor() !== undefined;
      changed =
        (actor.sessionId !== undefined &&
          (this._children?.delete(actor.sessionId) ?? false)) ||
        changed;
    } else {
      changed =
        actor.sessionId !== undefined &&
        (this._children?.delete(actor.sessionId) ?? false);
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

  // Unlike the other operations, spawn has no local work: local actors
  // register with the system when they are constructed, so this only
  // notifies a host runtime.
  public spawnActor(
    source: AnyActor | undefined,
    actor: AnyActor
  ): void | PromiseLike<void> {
    return this.runtime?.spawnActor?.(source, actor);
  }

  public startActor(actor: AnyActor): void | PromiseLike<void> {
    const override = this.runtime?.startActor;
    if (override) {
      return override(actor);
    }
    actor.start();
  }

  public stopActor(actor: AnyActor): void | PromiseLike<void> {
    const override = this.runtime?.stopActor;
    if (override) {
      return override(actor);
    }
    stopActorLocally(actor);
  }

  public terminateActor(
    actor: AnyActor,
    termination: ActorTermination
  ): void | PromiseLike<void> {
    const override = this.runtime?.terminateActor;
    if (override) {
      return override(actor, termination);
    }
    terminateActorLocally(actor, termination);
  }

  public sendEvent(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ): void | PromiseLike<void> {
    assertEventCanBeSent(source, target, event);
    // Record for the inspection `sent[]` facet regardless of which runtime
    // delivers, so host runtimes keep inspection parity.
    this._recordSent(source, target, event);
    const override = this.runtime?.sendEvent;
    if (override) {
      return override(source, target, event);
    }
    this._deliver(source, target, event);
  }

  public emitEvent(
    source: AnyActor,
    event: EventObject
  ): void | PromiseLike<void> {
    const override = this.runtime?.emitEvent;
    if (override) {
      return override(source, event);
    }
    (source as AnyActor & { _emit(value: EventObject): void })._emit(event);
  }

  public deadLetter(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject,
    reason: string
  ): void | PromiseLike<void> {
    this._sendInspectionEvent({
      type: '@xstate.deadletter',
      actorRef: target,
      sourceRef: source,
      event,
      reason
    });
    const override = this.runtime?.deadLetter;
    if (override) {
      return override(source, target, event, reason);
    }
    if (isDevelopment) {
      console.warn(
        `Event "${event.type}" to actor "${target.id}" was not delivered (${reason}).`
      );
    }
  }

  public runStep(
    actor: AnyActor,
    key: string,
    exec: () => unknown | PromiseLike<unknown>
  ): unknown | PromiseLike<unknown> {
    const override = this.runtime?.runStep;
    if (override) {
      return override(actor, key, exec);
    }
    return runStep(actor, key, exec);
  }

  public runLogic(
    actor: AnyActor,
    exec: () => PromiseLike<unknown>
  ): PromiseLike<unknown> {
    const override = this.runtime?.runLogic;
    if (override) {
      return override(actor, exec);
    }
    return exec();
  }

  public scheduleTimer(
    source: AnyActor,
    id: string,
    delay: number
  ): void | PromiseLike<void> {
    const override = this.runtime?.scheduleTimer;
    if (override) {
      // The local scheduler records delayed sends for inspection inside
      // `schedule`; keep that parity for host runtimes.
      const timer = source.getSnapshot()?.timers?.[id];
      if (timer) {
        const target = timer.target === 'self' ? source : timer.target;
        this._recordSent(source, target, timer.event, delay, id);
      }
      return override(source, id, delay);
    }
    this.schedule(source, id, delay);
  }

  public cancelTimer(source: AnyActor, id: string): void | PromiseLike<void> {
    const override = this.runtime?.cancelTimer;
    if (override) {
      return override(source, id);
    }
    this.cancel(source, id);
  }

  public cancelAllTimers(source: AnyActor): void | PromiseLike<void> {
    const override = this.runtime?.cancelAllTimers;
    if (override) {
      return override(source);
    }
    this.cancelAll(source);
  }

  public _relay(
    source: AnyActor | undefined,
    target: AnyActor,
    event: AnyEventObject
  ): void | PromiseLike<void> {
    if (
      transitionEffectTargets.length &&
      transitionEffectTargets.includes(target)
    ) {
      throw transitionEffectSignal;
    }
    // Returned so callers that can observe a host runtime's asynchronous
    // delivery do; the built-in runtime delivers synchronously.
    return this.sendEvent(source, target, event);
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
    let resetScheduledTimers = true;
    for (const scheduledId in scheduledTimers) {
      if (resetScheduledTimers) {
        this._snapshot._scheduledTimers = {};
        resetScheduledTimers = false;
      }
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
