import isDevelopment from '#is-development';
import type { ActionRecord, SentRecord } from './inspection.ts';
import { Mailbox } from './Mailbox.ts';
import { XSTATE_STOP } from './constants.ts';
import {
  createDoneActorEvent,
  createErrorActorEvent,
  createInitEvent
} from './eventUtils.ts';
import { reportUnhandledError } from './reportUnhandledError.ts';
import { symbolObservable } from './symbolObservable.ts';
import {
  encodeAddressSegment,
  AnyActorSystem,
  bookSessionId,
  Clock,
  createRuntimeSystem,
  resolveActorId
} from './system.ts';

// those are needed to make JSDoc `@link` work properly
// oxlint-disable no-unused-vars
import type {
  createObservableLogic,
  createEventObservableLogic
} from './actors/observable.ts';
import type { createCallbackLogic } from './actors/callback.ts';
import type { createLogic } from './actors/logic.ts';
import type { createAsyncLogic } from './actors/promise.ts';
import type { createMachine } from './createMachine.ts';
// oxlint-enable no-unused-vars

let executingCustomAction: boolean = false;

import type {
  ActorTermination,
  ActorScope,
  ActorTrigger,
  AnyActor,
  AnyActorLogic,
  EmittedFrom,
  EventFromLogic,
  SendableEventFromLogic,
  InputFrom,
  PersistedSnapshotFor,
  Snapshot,
  SnapshotFrom,
  AnyTransitionDefinition,
  ExecutableActionObject,
  Readable,
  ActorLogicTransitionResult
} from './types.ts';
import {
  ActorOptions,
  ActorInstance,
  ActorRef,
  EventObject,
  InteropSubscribable,
  Observer,
  Subscription
} from './types.ts';
import { toObserver } from './utils.ts';
import { finalizeTransitionResult } from './transitionActions.ts';
import { setSnapshotActorRef } from './snapshotActorRef.ts';

/**
 * Marks a serialized object as an actor reference (`xstate$type` in JSON
 * output and persisted context).
 */
export const ACTOR_REF_TYPE = 'actorRef';

const emptyInspectionRecords = Object.freeze([]) as unknown as never[];

// those values are currently used by @xstate/react directly so it's important to keep the assigned values in sync
export enum ProcessingStatus {
  NotStarted = 0,
  Running = 1,
  Stopped = 2
}

const defaultOptions = Object.freeze({
  clock: {
    setTimeout: (fn, ms) => {
      return setTimeout(fn, ms);
    },
    clearTimeout: (id) => {
      return clearTimeout(id);
    }
  } as Clock,
  logger: console.log.bind(console)
});

function safeCall<T>(fn: ((arg: T) => void) | undefined, arg?: T) {
  try {
    fn?.(arg as T);
  } catch (err) {
    reportUnhandledError(err);
  }
}

function executeExecutableEffects(
  effects: readonly ExecutableActionObject[] | undefined,
  actorScope: ActorScope<any, any, any, any>
): void {
  if (!effects?.length) {
    return;
  }

  for (const effect of effects) {
    actorScope.actionExecutor(effect);
  }
}

function createActorRef(
  logic: AnyActorLogic,
  options: ActorOptions<AnyActorLogic>
): AnyActor {
  return new Actor(logic, options);
}

/**
 * An Actor is a running process that can receive events, send events and change
 * its behavior based on the events it receives, which can cause effects outside
 * of the actor. When you run a state machine, it becomes an actor.
 *
 * An `Actor` is the concrete runtime instance with lifecycle methods and
 * system-owned internals. It also satisfies the narrower `ActorRef` contract,
 * so consumer APIs should accept `ActorRef` when they only need to send events
 * or read snapshots.
 */
export class Actor<TLogic extends AnyActorLogic> implements ActorInstance<
  SnapshotFrom<TLogic>,
  EventFromLogic<TLogic>,
  EmittedFrom<TLogic>,
  SendableEventFromLogic<TLogic>
> {
  /** The current internal state of the actor. */
  private _snapshot!: SnapshotFrom<TLogic>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as
   * delayed events and transitions.
   */
  public clock: Clock;
  public options: Readonly<ActorOptions<TLogic>>;

  /** The unique identifier for this actor relative to its parent. */
  public id: string;

  private _boundProcess?: (event: EventFromLogic<TLogic>) => void;
  private mailbox?: Mailbox<EventFromLogic<TLogic>>;
  private _mailboxStarted = false;

  private observers?: Set<Observer<SnapshotFrom<TLogic>>>;
  private eventListeners:
    | Map<string, Set<(emittedEvent: EmittedFrom<TLogic>) => void>>
    | undefined;
  private logger: (...args: any[]) => void;

  /** @internal */
  public _processingStatus: ProcessingStatus = ProcessingStatus.NotStarted;
  private _forceDeferredActions = false;

  // Actor Ref
  public _parent?: AnyActor;
  /** @internal */
  public _syncSnapshot?: boolean;
  public ref: ActorRef<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>,
    EmittedFrom<TLogic>,
    SendableEventFromLogic<TLogic>
  >;
  // TODO: add typings for system
  private _actorScope: ActorScope<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>,
    AnyActorSystem,
    EmittedFrom<TLogic>,
    SendableEventFromLogic<TLogic>
  >;

  /** @internal */
  public _lastSourceRef?: AnyActor;
  /** @internal */
  public _collectedMicrosteps: AnyTransitionDefinition[] | undefined;
  /** @internal Actions executed during the in-flight transition. */
  public _collectedActions: ActionRecord[] | undefined;
  /** @internal Events relayed to other actors during the in-flight transition. */
  public _collectedSent: SentRecord[] | undefined;
  private _initialEffects: ExecutableActionObject[] | undefined;
  public registryKey: string | undefined;

  /** The globally unique process ID for this invocation. */
  public sessionId: string;

  private _address?: string;
  /**
   * The deterministic logical address of this actor within its system: the
   * `/`-joined path of actor ids from the root. Stable across persistence and
   * restore, unlike `sessionId`, which identifies one incarnation.
   *
   * `/` separates segments, so an id containing one (a state name with a
   * slash reaches its invoked child's id) is percent-encoded to keep the
   * path unambiguous.
   */
  public get address(): string {
    // `id` and `_parent` never change after construction, so the whole chain
    // memoizes to O(1) amortized.
    return (this._address ??= this._parent
      ? `${this._parent.address}/${encodeAddressSegment(this.id)}`
      : encodeAddressSegment(this.id));
  }

  /** The system to which this actor belongs. */
  public system: AnyActorSystem;

  private _trigger?: ActorTrigger<SendableEventFromLogic<TLogic>>;

  public get trigger(): ActorTrigger<SendableEventFromLogic<TLogic>> {
    return (this._trigger ??= new Proxy({} as Actor<TLogic>['trigger'], {
      get: (_, eventType: string) => {
        return (payload?: Record<PropertyKey, unknown>) => {
          this.send({
            ...payload,
            type: eventType
          } as SendableEventFromLogic<TLogic>);
        };
      }
    }) as ActorTrigger<SendableEventFromLogic<TLogic>>);
  }

  private _boundSend?: ActorRef<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>,
    EmittedFrom<TLogic>,
    SendableEventFromLogic<TLogic>
  >['send'];

  public get send(): ActorRef<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>,
    EmittedFrom<TLogic>,
    SendableEventFromLogic<TLogic>
  >['send'] {
    return (this._boundSend ??= this._sendPublic.bind(this));
  }

  public src: string | AnyActorLogic;

  /**
   * Creates a new actor instance for the given logic with the provided options,
   * if any.
   *
   * @param logic The logic to create an actor from
   * @param options Actor options
   */
  constructor(
    public logic: TLogic,
    options?: ActorOptions<TLogic>
  ) {
    const resolvedOptions = (
      options ? { ...defaultOptions, ...options } : defaultOptions
    ) as ActorOptions<TLogic> & typeof defaultOptions;

    const { clock, logger, parent, syncSnapshot, id, registryKey, inspect } =
      resolvedOptions;

    this.system = parent
      ? parent.system
      : (resolvedOptions._systemRef?.current ??
        createRuntimeSystem(this, {
          clock,
          logger,
          snapshot: resolvedOptions.snapshot ?? resolvedOptions.state,
          createActorRef,
          onRejectedEvent: resolvedOptions.onRejectedEvent
        }));

    if (
      !parent &&
      resolvedOptions._systemRef &&
      !resolvedOptions._systemRef.current
    ) {
      resolvedOptions._systemRef.current = this.system;
    }

    if (inspect && !parent) {
      // Always inspect at the system-level
      this.system.inspect(toObserver(inspect));
    }

    this.sessionId = resolvedOptions._sessionId ?? bookSessionId(this.system);
    this.id = resolveActorId(this.system, id, {
      parent,
      src: resolvedOptions.src ?? logic
    });
    this.logger = options?.logger ?? this.system._logger;
    this.clock = options?.clock ?? this.system._clock;
    this._parent = parent;
    this._syncSnapshot = syncSnapshot;
    this.options = resolvedOptions as ActorOptions<TLogic> &
      typeof defaultOptions;
    this.src = resolvedOptions.src ?? logic;
    this.ref = this;
    this._actorScope = this as unknown as typeof this._actorScope;

    if (registryKey) {
      this.registryKey = registryKey;
      this.system._set(registryKey, this);
    }

    // prepare to collect initial microsteps during initialTransition
    this._collectedMicrosteps = undefined;
    const persistedState = options?.snapshot ?? options?.state;
    this._restored = persistedState !== undefined;
    try {
      if (persistedState) {
        this._setSnapshot(
          this.logic.restoreSnapshot
            ? this.logic.restoreSnapshot(persistedState, this._actorScope)
            : persistedState
        );
      } else if (options?._inert) {
        // Inert actors (createInertActorScope) only anchor a scope for pure
        // transition functions; computing an initial snapshot here would run
        // init-time side effects (context factories, entry) a second time.
      } else {
        const [snapshot, effects] = finalizeTransitionResult(
          this._actorScope,
          undefined,
          this.logic.initialTransition(this.options?.input, this._actorScope)
        );
        this._setSnapshot(snapshot);
        this._initialEffects = effects.length ? effects : undefined;
      }
    } catch (err) {
      // if we get here then it means that we assign a value to this._snapshot that is not of the correct type
      // we can't get the true `TSnapshot & { status: 'error'; }`, it's impossible
      // so right now this is a lie of sorts
      this._setSnapshot({
        status: 'error',
        output: undefined,
        error: err
      } as SnapshotFrom<TLogic>);
      // discard any functions deferred during the failed initial snapshot
      // computation so they can't run against an inconsistent actor
      if (this._deferred) {
        this._deferred.length = 0;
      }
    }

    if (
      registryKey &&
      (this._snapshot as Snapshot<unknown>).status !== 'active'
    ) {
      this.system._unregister(this);
    }

    // Announce actor topology: emitted once for every actor (root and every
    // spawned/invoked child) so the actor graph can be drawn before any
    // transitions occur. This is the only place actor identity is announced.
    if (this.system._hasInspectionObservers()) {
      this.system._sendInspectionEvent({
        type: '@xstate.actor',
        actorRef: this,
        parentRef: this._parent,
        id: this.id,
        src: this.src,
        snapshot: this._snapshot
      });
    }
  }

  // array of functions to defer
  private _deferred: Array<() => void> | undefined;

  private _restored = false;

  private get self(): Actor<TLogic> {
    return this;
  }

  private get defer(): (fn: () => void) => void {
    const defer = (fn: () => void) => this._defer(fn);
    if (isDevelopment) {
      Object.defineProperty(this, 'defer', { value: defer });
    }
    return defer;
  }

  private get stopChild(): (child: AnyActor) => void {
    const stopChild = (child: AnyActor) => this._stopChild(child);
    if (isDevelopment) {
      Object.defineProperty(this, 'stopChild', { value: stopChild });
    }
    return stopChild;
  }

  private get emit(): (event: EmittedFrom<TLogic>) => void | PromiseLike<void> {
    const emit = (event: EmittedFrom<TLogic>) =>
      this.system.emitEvent(this, event);
    if (isDevelopment) {
      Object.defineProperty(this, 'emit', { value: emit });
    }
    return emit;
  }

  private get actionExecutor(): (action: ExecutableActionObject) => void {
    const actionExecutor = (action: ExecutableActionObject) =>
      this._executeAction(action);
    if (isDevelopment) {
      Object.defineProperty(this, 'actionExecutor', { value: actionExecutor });
    }
    return actionExecutor;
  }

  /** @internal */
  public _isRunning(): boolean {
    return this._processingStatus === ProcessingStatus.Running;
  }

  /** @internal */
  public _defer(fn: () => void): void {
    (this._deferred ??= []).push(fn);
  }

  /** @internal */
  public _stopChild(child: AnyActor): void {
    if (child._parent !== this) {
      throw new Error(
        isDevelopment
          ? `Cannot stop child actor ${child.id} of ${this.id} because it is not a child`
          : `Cannot stop non-child actor ${child.id}`
      );
    }
    (child as Actor<AnyActorLogic>)._stop();
  }

  /** @internal */
  public _executeAction(action: ExecutableActionObject): void {
    const exec = () => {
      // Record every executed action for the '@xstate.transition' inspection
      // event's `actions[]` facet (replaces the v5 '@xstate.action' event).
      if (this.system._hasInspectionObservers()) {
        (this._collectedActions ??= []).push({
          type: action.type,
          params: action.params
        });
      }
      const saveExecutingCustomAction = executingCustomAction;
      try {
        executingCustomAction = true;
        void action.exec();
      } finally {
        executingCustomAction = saveExecutingCustomAction;
      }
    };
    if (
      this._processingStatus === ProcessingStatus.Running &&
      !this._forceDeferredActions
    ) {
      exec();
    } else {
      (this._deferred ??= []).push(exec);
    }
  }

  /** Associates each live snapshot with this actor for later pure transitions. */
  private _setSnapshot(snapshot: SnapshotFrom<TLogic>): void {
    const previousSnapshot = this._snapshot;
    this._snapshot = snapshot;
    setSnapshotActorRef(snapshot, this, this.system, previousSnapshot);
  }

  private _setErrorSnapshot(
    err: unknown,
    snapshot: SnapshotFrom<TLogic> = this._snapshot
  ) {
    this._setSnapshot({
      ...(snapshot as Snapshot<unknown>),
      status: 'error',
      error: err
    } as SnapshotFrom<TLogic>);
  }

  /** Recover via the logic's error event if possible; otherwise error out. */
  private _recoverOrError(
    err: unknown,
    snapshot?: SnapshotFrom<TLogic>
  ): boolean {
    if (this._tryHandleExecutionError(err, snapshot)) {
      return true;
    }
    this._setErrorSnapshot(err);
    this._error(err);
    return false;
  }

  private _tryHandleExecutionError(
    err: unknown,
    snapshot: SnapshotFrom<TLogic> = this._snapshot
  ): boolean {
    // Machine logic can recover from execution errors via `onError`
    // transitions; the logic decides (so the actor stays logic-agnostic).
    const errorEvent = this.logic.getExecutionErrorEvent?.(snapshot, err) as
      | EventFromLogic<TLogic>
      | undefined;
    if (!errorEvent) {
      return false;
    }

    try {
      const [nextSnapshot, effects] = finalizeTransitionResult(
        this._actorScope,
        snapshot,
        this.logic.transition(snapshot, errorEvent, this._actorScope)
      );
      this._setSnapshot(nextSnapshot);
      executeExecutableEffects(effects, this._actorScope);
      this.update(nextSnapshot, errorEvent);
      return true;
    } catch {
      return false;
    }
  }

  private _next(snapshot: SnapshotFrom<TLogic>) {
    for (const observer of this.observers ?? emptyInspectionRecords) {
      safeCall(observer.next, snapshot);
    }
  }

  private update(snapshot: SnapshotFrom<TLogic>, event: EventObject): void {
    // Update state
    this._setSnapshot(snapshot);

    // Execute deferred effects
    const deferred = this._deferred;
    for (let i = 0; i < (deferred?.length ?? 0); i++) {
      const deferredFn = deferred![i];
      try {
        deferredFn();
      } catch (err) {
        // this error can only be caught when executing *initial* actions
        // it's the only time when we call actions provided by the user through those deferreds
        // when the actor is already running we always execute them synchronously while transitioning
        // no "builtin deferred" should actually throw an error since they are either safe
        // or the control flow is passed through the mailbox and errors should be caught by the `_process` used by the mailbox
        deferred!.length = 0;
        if (this._tryHandleExecutionError(err, snapshot)) {
          return;
        }
        this._setErrorSnapshot(err, snapshot);
        this._error(err);
        break;
      }
    }
    if (deferred) {
      deferred.length = 0;
    }

    switch ((this._snapshot as Snapshot<unknown>).status) {
      case 'active':
        this._next(snapshot);
        break;
      case 'done':
      case 'error':
        // Terminal lifecycle is represented by the ordered
        // `@xstate.terminate` effect returned by the actor logic.
        break;
    }
    this._inspectTransition(this._snapshot, event);
  }

  /** @internal Emits the transition inspection event; used by the pure
   * `transition()` path for snapshots driven outside a live actor. */
  public _inspectTransition(
    snapshot: SnapshotFrom<TLogic>,
    event: EventObject
  ): void {
    if (this.system._hasInspectionObservers()) {
      this.system._sendInspectionEvent({
        type: '@xstate.transition',
        actorRef: this,
        event,
        sourceRef: this._lastSourceRef,
        targetRef: this,
        snapshot,
        microsteps: this._collectedMicrosteps ?? emptyInspectionRecords,
        actions: this._collectedActions ?? emptyInspectionRecords,
        sent: this._collectedSent ?? emptyInspectionRecords,
        eventType: event.type
      });
    }
    this._collectedMicrosteps = undefined;
    this._collectedActions = undefined;
    this._collectedSent = undefined;
  }

  private _flushInitialEffects(): boolean {
    if (!this._initialEffects?.length) {
      return true;
    }
    this._forceDeferredActions = true;
    try {
      executeExecutableEffects(this._initialEffects, this._actorScope);
      this._initialEffects = undefined;
      return true;
    } catch (err) {
      this._initialEffects = undefined;
      if (this._deferred) {
        this._deferred.length = 0;
      }
      this._recoverOrError(err);
      return (this._snapshot as Snapshot<unknown>).status === 'active';
    } finally {
      this._forceDeferredActions = false;
    }
  }

  /**
   * Subscribe an observer to an actor’s snapshot values.
   *
   * @remarks
   * The observer will receive the actor’s snapshot value when it is emitted.
   * The observer can be:
   *
   * - A plain function that receives the latest snapshot, or
   * - An observer object whose `.next(snapshot)` method receives the latest
   *   snapshot
   *
   * @example
   *
   * ```ts
   * // Observer as a plain function
   * const subscription = actor.subscribe((snapshot) => {
   *   console.log(snapshot);
   * });
   * ```
   *
   * @example
   *
   * ```ts
   * // Observer as an object
   * const subscription = actor.subscribe({
   *   next(snapshot) {
   *     console.log(snapshot);
   *   },
   *   error(err) {
   *     // ...
   *   },
   *   complete() {
   *     // ...
   *   }
   * });
   * ```
   *
   * The return value of `actor.subscribe(observer)` is a subscription object
   * that has an `.unsubscribe()` method. You can call
   * `subscription.unsubscribe()` to unsubscribe the observer:
   *
   * @example
   *
   * ```ts
   * const subscription = actor.subscribe((snapshot) => {
   *   // ...
   * });
   *
   * // Unsubscribe the observer
   * subscription.unsubscribe();
   * ```
   *
   * When the actor is stopped, all of its observers will automatically be
   * unsubscribed.
   *
   * @param observer - Either a plain function that receives the latest
   *   snapshot, or an observer object whose `.next(snapshot)` method receives
   *   the latest snapshot
   */
  public subscribe(observer: Observer<SnapshotFrom<TLogic>>): Subscription;
  public subscribe(
    nextListener?: (snapshot: SnapshotFrom<TLogic>) => void,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription;
  public subscribe(
    nextListenerOrObserver?:
      | ((snapshot: SnapshotFrom<TLogic>) => void)
      | Observer<SnapshotFrom<TLogic>>,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription {
    const observer = toObserver(
      nextListenerOrObserver,
      errorListener,
      completeListener
    );

    if (this._processingStatus !== ProcessingStatus.Stopped) {
      (this.observers ??= new Set()).add(observer);
    } else {
      switch ((this._snapshot as Snapshot<unknown>).status) {
        case 'done':
          safeCall(observer.complete);
          break;
        case 'error': {
          const err = (this._snapshot as Snapshot<unknown>).error;
          if (!observer.error) {
            reportUnhandledError(err);
          } else {
            safeCall(observer.error, err);
          }
          break;
        }
      }
    }

    return {
      unsubscribe: () => {
        this.observers?.delete(observer);
      }
    };
  }

  public on<TType extends EmittedFrom<TLogic>['type'] | '*'>(
    type: TType,
    handler: (
      emitted: EmittedFrom<TLogic> &
        (TType extends '*' ? unknown : { type: TType })
    ) => void
  ): Subscription {
    let listeners = this.eventListeners?.get(type);
    if (!listeners) {
      listeners = new Set();
      (this.eventListeners ??= new Map()).set(type, listeners);
    }
    listeners.add(handler as (emittedEvent: EmittedFrom<TLogic>) => void);

    return {
      unsubscribe: () => {
        listeners.delete(
          handler as (emittedEvent: EmittedFrom<TLogic>) => void
        );
      }
    };
  }

  public select<TSelected>(
    selector: (snapshot: SnapshotFrom<TLogic>) => TSelected,
    equalityFn: (a: TSelected, b: TSelected) => boolean = Object.is
  ): Readable<TSelected> {
    return {
      subscribe: (
        observerOrFn:
          | Observer<TSelected>
          | ((value: TSelected) => void)
          | undefined,
        errorListener?: (error: any) => void,
        completeListener?: () => void
      ) => {
        const observer = toObserver(
          observerOrFn,
          errorListener,
          completeListener
        );
        let selected = selector(this.getSnapshot());
        return this.subscribe({
          next: (snapshot) => {
            const next = selector(snapshot);
            if (!equalityFn(selected, next)) {
              selected = next;
              observer.next?.(next);
            }
          },
          error: observer.error,
          complete: observer.complete
        });
      },
      get: () => selector(this.getSnapshot())
    };
  }

  /** Starts the Actor from the initial state */
  public start(): this {
    if (this._processingStatus === ProcessingStatus.Running) {
      // Do not restart the service if it is already started
      return this;
    }

    if (this._processingStatus === ProcessingStatus.Stopped) {
      return this;
    }

    if (this._syncSnapshot) {
      this.subscribe({
        next: (snapshot: Snapshot<unknown>) => {
          if (snapshot.status === 'active') {
            this.system._relay(this, this._parent!, {
              type: 'xstate.snapshot.actor',
              actorId: this.id,
              sessionId: this.sessionId,
              snapshot
            });
          }
        },
        error: () => {}
      });
    }

    this.system._register(this.sessionId, this);
    if (this.registryKey) {
      this.system._set(this.registryKey, this);
    }
    this._processingStatus = ProcessingStatus.Running;

    this._lastSourceRef = this._parent;

    const status = (this._snapshot as Snapshot<unknown>).status;

    switch (status) {
      case 'done':
        // a state machine can be "done" upon initialization (it could reach a final state using initial microsteps)
        // we still need to complete observers, flush deferreds etc
        if (this._restored) {
          // Restoration does not replay the transition that originally
          // terminated the actor, and must not notify the parent again.
          this._next(this._snapshot);
          this._stopProcedure();
          this._complete();
          return this;
        }
        if (!this._flushInitialEffects()) {
          return this;
        }
        this.update(
          this._snapshot,
          createInitEvent(
            this.options.input
          ) as unknown as EventFromLogic<TLogic>
        );
        // TODO: rethink cleanup of observers, mailbox, etc
        return this;
      case 'error':
        this._error((this._snapshot as Snapshot<unknown>).error);
        return this;
    }

    if (!this._parent) {
      this.system.start();
    }

    if (!this._flushInitialEffects()) {
      return this;
    }

    if (this.logic.start) {
      try {
        this.logic.start(this._snapshot, this._actorScope, {
          restored: this._restored
        });
      } catch (err) {
        this._setErrorSnapshot(err);
        this._error(err);
        return this;
      }
    }

    this.update(
      this._snapshot,
      createInitEvent(this.options.input) as unknown as EventFromLogic<TLogic>
    );

    if (this._restored) {
      type RestoredTimer = { id: string; delay: number; startedAt?: number };
      const timers =
        (
          this._snapshot as unknown as {
            timers?: Record<string, RestoredTimer>;
          }
        ).timers ?? {};
      // startedAt is only persisted from — and only meaningful under — the
      // wall clock; a custom clock (a simulated clock, a monotonic counter)
      // restores every timer with its declared delay. The clamp bounds
      // remaining time by the declared delay in case the wall clock moved
      // backwards between persist and restore.
      const wallClock = !this.system._clock.now;
      const now = Date.now();
      for (const timer of Object.values(timers)) {
        // A timer persisted from a live runtime carries its wall-clock start;
        // honor the absolute deadline instead of restarting the full delay.
        // Without a start (a pure-transition snapshot, or an older snapshot)
        // the declared delay is all there is.
        const delay =
          wallClock && timer.startedAt !== undefined
            ? Math.min(
                timer.delay,
                Math.max(0, timer.startedAt + timer.delay - now)
              )
            : timer.delay;
        this.system.scheduleTimer(this, timer.id, delay);
      }
      this._restored = false;
    }

    this._mailboxStarted = true;
    this.mailbox?.start();

    return this;
  }

  private _process(event: EventFromLogic<TLogic>) {
    let nextState: ActorLogicTransitionResult<SnapshotFrom<TLogic>> | undefined;
    let caughtError;
    try {
      nextState = finalizeTransitionResult(
        this._actorScope,
        this._snapshot,
        this.logic.transition(this._snapshot, event, this._actorScope)
      );
    } catch (err) {
      // we wrap it in a box so we can rethrow it later even if falsy value gets caught here
      caughtError = { err };
    }

    if (caughtError) {
      this._collectedMicrosteps = undefined;
      this._collectedActions = undefined;
      this._collectedSent = undefined;
      if (!this._recoverOrError(caughtError.err)) {
        this._inspectTransition(this._snapshot, event);
      }
      return;
    }
    if (!nextState) {
      return;
    }

    let snapshot = this._snapshot;
    try {
      const [nextSnapshot, effects] = nextState;
      snapshot = nextSnapshot;
      this._setSnapshot(snapshot);
      executeExecutableEffects(effects, this._actorScope);
      this.update(snapshot, event);
    } catch (err) {
      if (!this._recoverOrError(err, snapshot)) {
        this._inspectTransition(this._snapshot, event);
      }
      return;
    }

    if (event.type === XSTATE_STOP) {
      this._stopProcedure();
      this._complete();
    }
  }

  /** @internal */
  public _emit(event: EmittedFrom<TLogic>): void {
    for (const listeners of [
      this.eventListeners?.get(event.type),
      this.eventListeners?.get('*')
    ]) {
      if (listeners) {
        for (const handler of listeners) {
          safeCall(handler, event);
        }
      }
    }
  }

  /** @internal */
  public _terminate(termination: ActorTermination): void {
    if (termination.status === 'done') {
      // The terminal snapshot is published before observer completion and the
      // parent notification, matching actor lifecycle order.
      this._next(this._snapshot);
      this._stopProcedure();
      this._complete();
      if (this._parent) {
        this.system._relay(
          this,
          this._parent,
          createDoneActorEvent(this.id, termination.output, this.sessionId)
        );
      }
      return;
    }
    if (termination.status === 'error') {
      this._error(termination.error);
    }
  }

  /** @internal */
  public _stop(): this {
    if (this._processingStatus === ProcessingStatus.Stopped) {
      return this;
    }
    this.mailbox?.clear();
    if (this._processingStatus === ProcessingStatus.NotStarted) {
      this._processingStatus = ProcessingStatus.Stopped;
      this.system._unregister(this);
      return this;
    }
    this._send({ type: XSTATE_STOP } as EventFromLogic<TLogic>);
    this.system._unregister(this);

    return this;
  }

  /** Stops the Actor and unsubscribe all listeners. */
  public stop(): this {
    if (this._parent) {
      throw new Error('A non-root actor cannot be stopped directly.');
    }
    return this._stop();
  }
  private _complete(): void {
    for (const observer of this.observers ?? emptyInspectionRecords) {
      safeCall(observer.complete);
    }
    this.observers?.clear();
    this.eventListeners?.clear();
  }

  private _error(err: unknown): void {
    this._stopProcedure();
    if (!this.observers?.size) {
      if (!this._parent) {
        reportUnhandledError(err);
      }
    } else {
      let reportError = false;

      for (const observer of this.observers) {
        const errorListener = observer.error;
        reportError ||= !errorListener;
        safeCall(errorListener, err);
      }
      this.observers.clear();
      if (reportError) {
        reportUnhandledError(err);
      }
    }
    this.eventListeners?.clear();

    if (this._parent) {
      this.system._relay(
        this,
        this._parent,
        createErrorActorEvent(this.id, err, this.sessionId)
      );
    }
  }
  // TODO: atm children don't belong entirely to the actor so
  // in a way - it's not even super aware of them
  // so we can't stop them from here but we really should!
  // right now, they are being stopped within the machine's transition
  // but that could throw and leave us with "orphaned" active actors
  private _stopProcedure(): void {
    if (this._processingStatus !== ProcessingStatus.Running) {
      // Actor already stopped; do nothing
      return;
    }

    // Cancel all delayed events
    this.system.cancelAllTimers(this);

    // TODO: mailbox.reset
    this.mailbox?.clear();
    this.mailbox = undefined;
    this._boundProcess = undefined;
    this._mailboxStarted = false;

    this._processingStatus = ProcessingStatus.Stopped;
    this.system._unregister(this);
  }

  /** @internal */
  public _send(event: EventFromLogic<TLogic>) {
    if (this._processingStatus === ProcessingStatus.Stopped) {
      this.system.deadLetter(
        this._lastSourceRef,
        this as AnyActor,
        event,
        'stopped'
      );
      return;
    }

    let mailbox = this.mailbox;
    if (!mailbox) {
      this._boundProcess ??= this._process.bind(this);
      mailbox = this.mailbox = new Mailbox(this._boundProcess);
      if (this._mailboxStarted) {
        mailbox.start();
      }
    }
    mailbox.enqueue(event);
  }

  /**
   * Sends an event to the running Actor to trigger a transition.
   *
   * @param event The event to send
   */
  private _sendPublic(event: SendableEventFromLogic<TLogic>) {
    if (isDevelopment && typeof event === 'string') {
      throw new Error(
        `Only event objects may be sent to actors; use .send({ type: "${event}" }) instead`
      );
    }
    this.system._relay(undefined, this, event);
  }

  /**
   * Returns the actor's serializable logical identity: its `id`, `address`,
   * and registered source key (when the actor was created from one).
   */
  public toJSON() {
    return {
      xstate$type: ACTOR_REF_TYPE,
      id: this.id,
      address: this.address,
      src: typeof this.src === 'string' ? this.src : undefined
    };
  }

  /**
   * Obtain the internal state of the actor, which can be persisted.
   *
   * @remarks
   * The internal state can be persisted from any actor, not only machines.
   *
   * Note that the persisted state is not the same as the snapshot from
   * {@link Actor.getSnapshot}. Persisted state represents the internal state of
   * the actor, while snapshots represent the actor's last emitted value.
   *
   * Can be restored with {@link ActorOptions.state}
   * @see https://stately.ai/docs/persistence
   */
  public getPersistedSnapshot(options?: {
    /**
     * Whether persisted machine children embed their own persisted state
     * (the co-locating runtime's whole-tree checkpoint) or are referenced by
     * logical address only, leaving each child's state with the runtime that
     * owns it. Defaults to `true`.
     */
    embedChildren?: boolean;
  }): Snapshot<unknown> & PersistedSnapshotFor<TLogic>;
  public getPersistedSnapshot(
    options?: unknown
  ): Snapshot<unknown> & PersistedSnapshotFor<TLogic> {
    return this.logic.getPersistedSnapshot(
      this._snapshot,
      options
    ) as Snapshot<unknown> & PersistedSnapshotFor<TLogic>;
  }

  public [symbolObservable](): InteropSubscribable<SnapshotFrom<TLogic>> {
    return this;
  }

  /**
   * Read an actor’s snapshot synchronously.
   *
   * @remarks
   * The snapshot is the last value the actor published, not a query of its
   * private state: the actor emits a snapshot when it transitions, and this
   * returns that cached last emission. The read is coherent within one
   * synchronous transition turn because event processing runs to completion;
   * across asynchronous boundaries it may be stale, like any observed value.
   *
   * Only co-located actors publish full snapshots. A location-transparent
   * remote handle exposes lifecycle only ({ status, output?, error? }): while
   * the handle exists among its parent's children the child is presumed
   * `active`, and its terminal result arrives as a completion event.
   *
   * Note that some actors, such as callback actors generated with
   * `createCallbackLogic`, will not emit snapshots.
   * @see {@link Actor.subscribe} to subscribe to an actor’s snapshot values.
   * @see {@link Actor.getPersistedSnapshot} to persist the internal state of an actor (which is more than just a snapshot).
   */
  public getSnapshot(): SnapshotFrom<TLogic> {
    if (isDevelopment && !this._snapshot) {
      throw new Error(
        `Snapshot can't be read while the actor initializes itself`
      );
    }
    return this._snapshot;
  }
}

export type RequiredActorOptionsKeys<TLogic extends AnyActorLogic> =
  undefined extends InputFrom<TLogic> ? never : 'input';

/**
 * Creates a new actor instance for the given actor logic with the provided
 * options, if any.
 *
 * @remarks
 * When you create an actor from actor logic via `createActor(logic)`, you
 * implicitly create an actor system where the created actor is the root actor.
 * Any actors spawned from this root actor and its descendants are part of that
 * actor system.
 * @example
 *
 * ```ts
 * import { createActor } from 'xstate';
 * import { someActorLogic } from './someActorLogic.ts';
 *
 * // Creating the actor, which implicitly creates an actor system with itself as the root actor
 * const actor = createActor(someActorLogic);
 *
 * actor.subscribe((snapshot) => {
 *   console.log(snapshot);
 * });
 *
 * // Actors must be started by calling `actor.start()`, which will also start the actor system.
 * actor.start();
 *
 * // Actors can receive events
 * actor.send({ type: 'someEvent' });
 *
 * // You can stop root actors by calling `actor.stop()`, which will also stop the actor system and all actors in that system.
 * actor.stop();
 * ```
 *
 * @param logic - The actor logic to create an actor from. For a state machine
 *   actor logic creator, see {@link createMachine}. Other actor logic creators
 *   include {@link createCallbackLogic}, {@link createEventObservableLogic},
 *   {@link createObservableLogic}, {@link createLogic}, and
 *   {@link createAsyncLogic}.
 * @param options - Actor options
 */
export function createActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic> & {
    [K in RequiredActorOptionsKeys<TLogic>]: unknown;
  }
): Actor<TLogic> {
  return new Actor(logic, options);
}
