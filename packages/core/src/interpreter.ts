import isDevelopment from '#is-development';
import { Mailbox } from './Mailbox.ts';
import {
  createDoneActorEvent,
  createErrorActorEvent,
  createInitEvent
} from './eventUtils.ts';
import { XSTATE_STOP } from './constants.ts';
import { devToolsAdapter } from './dev/index.ts';
import { reportUnhandledError } from './reportUnhandledError.ts';
import { symbolObservable } from './symbolObservable.ts';
import { createSystem } from './system.ts';
import {
  AreAllImplementationsAssumedToBeProvided,
  MissingImplementationsError
} from './typegenTypes.ts';
import type {
  ActorScope,
  ActorSystem,
  AnyActorLogic,
  AnyStateMachine,
  EventFromLogic,
  SnapshotFrom,
  AnyActorRef,
  DoneActorEvent,
  Snapshot
} from './types.ts';
import {
  ActorRef,
  EventObject,
  InteropSubscribable,
  ActorOptions,
  Observer,
  Subscription
} from './types.ts';
import { toObserver } from './utils.ts';

export const $$ACTOR_TYPE = 1;

export type SnapshotListener<TLogic extends AnyActorLogic> = (
  state: SnapshotFrom<TLogic>
) => void;

export type EventListener<TEvent extends EventObject = EventObject> = (
  event: TEvent
) => void;

export type Listener = () => void;
export type ErrorListener = (error: any) => void;

export interface Clock {
  setTimeout(fn: (...args: any[]) => void, timeout: number): any;
  clearTimeout(id: any): void;
}

// those values are currently used by @xstate/react directly so it's important to keep the assigned values in sync
export enum ProcessingStatus {
  NotStarted = 0,
  Running = 1,
  Stopped = 2
}

const defaultOptions = {
  clock: {
    setTimeout: (fn, ms) => {
      return setTimeout(fn, ms);
    },
    clearTimeout: (id) => {
      return clearTimeout(id);
    }
  } as Clock,
  logger: console.log.bind(console),
  devTools: false
};

/**
 * An Actor is a running process that can receive events, send events and change its behavior based on the events it receives, which can cause effects outside of the actor. When you run a state machine, it becomes an actor.
 */
export class Actor<TLogic extends AnyActorLogic>
  implements ActorRef<EventFromLogic<TLogic>, SnapshotFrom<TLogic>>
{
  /**
   * The current internal state of the actor.
   */
  private _state!: SnapshotFrom<TLogic>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;
  public options: Readonly<ActorOptions<TLogic>>;

  /**
   * The unique identifier for this actor relative to its parent.
   */
  public id: string;

  private mailbox: Mailbox<EventFromLogic<TLogic>> = new Mailbox(
    this._process.bind(this)
  );

  private delayedEventsMap: Record<string, unknown> = {};

  private observers: Set<Observer<SnapshotFrom<TLogic>>> = new Set();
  private logger: (...args: any[]) => void;

  /** @internal */
  public _processingStatus: ProcessingStatus = ProcessingStatus.NotStarted;

  // Actor Ref
  public _parent?: ActorRef<any, any>;
  public _syncSnapshot?: boolean;
  public ref: ActorRef<EventFromLogic<TLogic>, SnapshotFrom<TLogic>>;
  // TODO: add typings for system
  private _actorScope: ActorScope<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>,
    any
  >;

  private _systemId: string | undefined;

  /**
   * The globally unique process ID for this invocation.
   */
  public sessionId: string;

  /**
   * The system to which this actor belongs.
   */
  public system: ActorSystem<any>;
  private _doneEvent?: DoneActorEvent;

  public src: string | AnyActorLogic;

  /**
   * Creates a new actor instance for the given logic with the provided options, if any.
   *
   * @param logic The logic to create an actor from
   * @param options Actor options
   */
  constructor(
    public logic: TLogic,
    options?: ActorOptions<TLogic>
  ) {
    const resolvedOptions = {
      ...defaultOptions,
      ...options
    } as ActorOptions<TLogic> & typeof defaultOptions;

    const { clock, logger, parent, syncSnapshot, id, systemId, inspect } =
      resolvedOptions;

    this.system = parent?.system ?? createSystem(this);

    if (inspect && !parent) {
      // Always inspect at the system-level
      this.system.inspect(toObserver(inspect));
    }

    this.sessionId = this.system._bookId();
    this.id = id ?? this.sessionId;
    this.logger = logger;
    this.clock = clock;
    this._parent = parent;
    this._syncSnapshot = syncSnapshot;
    this.options = resolvedOptions;
    this.src = resolvedOptions.src ?? logic;
    this.ref = this;
    this._actorScope = {
      self: this,
      id: this.id,
      sessionId: this.sessionId,
      logger: this.logger,
      defer: (fn) => {
        this._deferred.push(fn);
      },
      system: this.system,
      stopChild: (child) => {
        if (child._parent !== this) {
          throw new Error(
            `Cannot stop child actor ${child.id} of ${this.id} because it is not a child`
          );
        }
        (child as any)._stop();
      }
    };

    // Ensure that the send method is bound to this Actor instance
    // if destructured
    this.send = this.send.bind(this);
    this.system._sendInspectionEvent({
      type: '@xstate.actor',
      actorRef: this
    });

    if (systemId) {
      this._systemId = systemId;
      this.system._set(systemId, this);
    }

    this._initState(options?.state);

    if (systemId && (this._state as any).status !== 'active') {
      this.system._unregister(this);
    }
  }

  private _initState(persistedState?: Snapshot<unknown>) {
    this._state = persistedState
      ? this.logic.restoreState
        ? this.logic.restoreState(persistedState, this._actorScope)
        : persistedState
      : this.logic.getInitialState(this._actorScope, this.options?.input);
  }

  // array of functions to defer
  private _deferred: Array<() => void> = [];

  private update(snapshot: SnapshotFrom<TLogic>, event: EventObject): void {
    // Update state
    this._state = snapshot;

    // Execute deferred effects
    let deferredFn: (typeof this._deferred)[number] | undefined;

    while ((deferredFn = this._deferred.shift())) {
      deferredFn();
    }

    for (const observer of this.observers) {
      try {
        observer.next?.(snapshot);
      } catch (err) {
        reportUnhandledError(err);
      }
    }

    switch ((this._state as any).status) {
      case 'done':
        this._stopProcedure();
        this._complete();
        this._doneEvent = createDoneActorEvent(
          this.id,
          (this._state as any).output
        );
        if (this._parent) {
          this.system._relay(this, this._parent, this._doneEvent);
        }

        break;
      case 'error':
        this._stopProcedure();
        this._error((this._state as any).error);
        if (this._parent) {
          this.system._relay(
            this,
            this._parent,
            createErrorActorEvent(this.id, (this._state as any).error)
          );
        }
        break;
    }
    this.system._sendInspectionEvent({
      type: '@xstate.snapshot',
      actorRef: this,
      event,
      snapshot
    });
  }

  /**
   * Subscribe an observer to an actor’s snapshot values.
   *
   * @remarks
   * The observer will receive the actor’s snapshot value when it is emitted. The observer can be:
   * - A plain function that receives the latest snapshot, or
   * - An observer object whose `.next(snapshot)` method receives the latest snapshot
   *
   * @example
   * ```ts
   * // Observer as a plain function
   * const subscription = actor.subscribe((snapshot) => {
   *   console.log(snapshot);
   * });
   * ```
   *
   * @example
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
   *   },
   * });
   * ```
   *
   * The return value of `actor.subscribe(observer)` is a subscription object that has an `.unsubscribe()` method. You can call `subscription.unsubscribe()` to unsubscribe the observer:
   *
   * @example
   * ```ts
   * const subscription = actor.subscribe((snapshot) => {
   *   // ...
   * });
   *
   * // Unsubscribe the observer
   * subscription.unsubscribe();
   * ```
   *
   * When the actor is stopped, all of its observers will automatically be unsubscribed.
   *
   * @param observer - Either a plain function that receives the latest snapshot, or an observer object whose `.next(snapshot)` method receives the latest snapshot
   */
  public subscribe(observer: Observer<SnapshotFrom<TLogic>>): Subscription;
  public subscribe(
    nextListener?: (state: SnapshotFrom<TLogic>) => void,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription;
  public subscribe(
    nextListenerOrObserver?:
      | ((state: SnapshotFrom<TLogic>) => void)
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
      this.observers.add(observer);
    } else {
      try {
        observer.complete?.();
      } catch (err) {
        reportUnhandledError(err);
      }
    }

    return {
      unsubscribe: () => {
        this.observers.delete(observer);
      }
    };
  }

  /**
   * Starts the Actor from the initial state
   */
  public start(): this {
    if (this._processingStatus === ProcessingStatus.Running) {
      // Do not restart the service if it is already started
      return this;
    }

    if (this._syncSnapshot) {
      this.subscribe({
        next: (snapshot: Snapshot<unknown>) => {
          if (snapshot.status === 'active') {
            this._parent!.send({
              type: `xstate.snapshot.${this.id}`,
              snapshot
            });
          }
        },
        error: () => {}
      });
    }

    this.system._register(this.sessionId, this);
    if (this._systemId) {
      this.system._set(this._systemId, this);
    }
    this._processingStatus = ProcessingStatus.Running;

    // TODO: this isn't correct when rehydrating
    const initEvent = createInitEvent(this.options.input);

    this.system._sendInspectionEvent({
      type: '@xstate.event',
      sourceRef: this._parent,
      actorRef: this,
      event: initEvent
    });

    const status = (this._state as any).status;

    switch (status) {
      case 'done':
        // a state machine can be "done" upon initialization (it could reach a final state using initial microsteps)
        // we still need to complete observers, flush deferreds etc
        this.update(
          this._state,
          initEvent as unknown as EventFromLogic<TLogic>
        );
      // fallthrough
      case 'error':
        // TODO: rethink cleanup of observers, mailbox, etc
        return this;
    }

    if (this.logic.start) {
      try {
        this.logic.start(this._state, this._actorScope);
      } catch (err) {
        this._stopProcedure();
        this._error(err);
        this._parent?.send(createErrorActorEvent(this.id, err));
        return this;
      }
    }

    // TODO: this notifies all subscribers but usually this is redundant
    // there is no real change happening here
    // we need to rethink if this needs to be refactored
    this.update(this._state, initEvent as unknown as EventFromLogic<TLogic>);

    if (this.options.devTools) {
      this.attachDevTools();
    }

    this.mailbox.start();

    return this;
  }

  private _process(event: EventFromLogic<TLogic>) {
    // TODO: reexamine what happens when an action (or a guard or smth) throws
    let nextState;
    let caughtError;
    try {
      nextState = this.logic.transition(this._state, event, this._actorScope);
    } catch (err) {
      // we wrap it in a box so we can rethrow it later even if falsy value gets caught here
      caughtError = { err };
    }

    if (caughtError) {
      const { err } = caughtError;

      this._stopProcedure();
      this._error(err);
      this._parent?.send(createErrorActorEvent(this.id, err));
      return;
    }

    this.update(nextState, event);
    if (event.type === XSTATE_STOP) {
      this._stopProcedure();
      this._complete();
    }
  }

  private _stop(): this {
    if (this._processingStatus === ProcessingStatus.Stopped) {
      return this;
    }
    this.mailbox.clear();
    if (this._processingStatus === ProcessingStatus.NotStarted) {
      this._processingStatus = ProcessingStatus.Stopped;
      return this;
    }
    this.mailbox.enqueue({ type: XSTATE_STOP } as any);

    return this;
  }

  /**
   * Stops the Actor and unsubscribe all listeners.
   */
  public stop(): this {
    if (this._parent) {
      throw new Error('A non-root actor cannot be stopped directly.');
    }
    return this._stop();
  }
  private _complete(): void {
    for (const observer of this.observers) {
      try {
        observer.complete?.();
      } catch (err) {
        reportUnhandledError(err);
      }
    }
    this.observers.clear();
  }
  private _error(err: unknown): void {
    if (!this.observers.size) {
      if (!this._parent) {
        reportUnhandledError(err);
      }
      return;
    }
    let reportError = false;

    for (const observer of this.observers) {
      const errorListener = observer.error;
      reportError ||= !errorListener;
      try {
        errorListener?.(err);
      } catch (err2) {
        reportUnhandledError(err2);
      }
    }
    this.observers.clear();
    if (reportError) {
      reportUnhandledError(err);
    }
  }
  private _stopProcedure(): this {
    if (this._processingStatus !== ProcessingStatus.Running) {
      // Actor already stopped; do nothing
      return this;
    }

    // Cancel all delayed events
    for (const key of Object.keys(this.delayedEventsMap)) {
      this.clock.clearTimeout(this.delayedEventsMap[key]);
    }

    // TODO: mailbox.reset
    this.mailbox.clear();
    // TODO: after `stop` we must prepare ourselves for receiving events again
    // events sent *after* stop signal must be queued
    // it seems like this should be the common behavior for all of our consumers
    // so perhaps this should be unified somehow for all of them
    this.mailbox = new Mailbox(this._process.bind(this));

    this._processingStatus = ProcessingStatus.Stopped;
    this.system._unregister(this);

    return this;
  }

  /**
   * @internal
   */
  public _send(event: EventFromLogic<TLogic>) {
    if (this._processingStatus === ProcessingStatus.Stopped) {
      // do nothing
      if (isDevelopment) {
        const eventString = JSON.stringify(event);

        console.warn(
          `Event "${event.type}" was sent to stopped actor "${this.id} (${this.sessionId})". This actor has already reached its final state, and will not transition.\nEvent: ${eventString}`
        );
      }
      return;
    }

    this.mailbox.enqueue(event);
  }

  /**
   * Sends an event to the running Actor to trigger a transition.
   *
   * @param event The event to send
   */
  public send(event: EventFromLogic<TLogic>) {
    if (isDevelopment && typeof event === 'string') {
      throw new Error(
        `Only event objects may be sent to actors; use .send({ type: "${event}" }) instead`
      );
    }
    this.system._relay(undefined, this, event);
  }

  /**
   * TODO: figure out a way to do this within the machine
   * @internal
   */
  public delaySend(params: {
    event: EventObject;
    id: string | undefined;
    delay: number;
    to?: AnyActorRef;
  }): void {
    const { event, id, delay } = params;
    const timerId = this.clock.setTimeout(() => {
      this.system._relay(
        this,
        params.to ?? this,
        event as EventFromLogic<TLogic>
      );
    }, delay);

    // TODO: consider the rehydration story here
    if (id) {
      this.delayedEventsMap[id] = timerId;
    }
  }

  /**
   * TODO: figure out a way to do this within the machine
   * @internal
   */
  public cancel(sendId: string | number): void {
    this.clock.clearTimeout(this.delayedEventsMap[sendId]);
    delete this.delayedEventsMap[sendId];
  }

  private attachDevTools(): void {
    const { devTools } = this.options;
    if (devTools) {
      const resolvedDevToolsAdapter =
        typeof devTools === 'function' ? devTools : devToolsAdapter;

      resolvedDevToolsAdapter(this);
    }
  }
  public toJSON() {
    return {
      xstate$$type: $$ACTOR_TYPE,
      id: this.id
    };
  }

  /**
   * Obtain the internal state of the actor, which can be persisted.
   *
   * @remarks
   * The internal state can be persisted from any actor, not only machines.
   *
   * Note that the persisted state is not the same as the snapshot from {@link Actor.getSnapshot}. Persisted state represents the internal state of the actor, while snapshots represent the actor's last emitted value.
   *
   * Can be restored with {@link ActorOptions.state}
   *
   * @see https://stately.ai/docs/persistence
   */
  public getPersistedState(): Snapshot<unknown>;
  public getPersistedState(options?: unknown): Snapshot<unknown> {
    return this.logic.getPersistedState(this._state, options);
  }

  public [symbolObservable](): InteropSubscribable<SnapshotFrom<TLogic>> {
    return this;
  }

  /**
   * Read an actor’s snapshot synchronously.
   *
   * @remarks
   * The snapshot represent an actor's last emitted value.
   *
   * When an actor receives an event, its internal state may change.
   * An actor may emit a snapshot when a state transition occurs.
   *
   * Note that some actors, such as callback actors generated with `fromCallback`, will not emit snapshots.
   *
   * @see {@link Actor.subscribe} to subscribe to an actor’s snapshot values.
   * @see {@link Actor.getPersistedState} to persist the internal state of an actor (which is more than just a snapshot).
   */
  public getSnapshot(): SnapshotFrom<TLogic> {
    return this._state;
  }
}

/**
 * Creates a new actor instance for the given actor logic with the provided options, if any.
 *
 * @remarks
 * When you create an actor from actor logic via `createActor(logic)`, you implicitly create an actor system where the created actor is the root actor.
 * Any actors spawned from this root actor and its descendants are part of that actor system.
 *
 * @example
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
 * @param logic - The actor logic to create an actor from. For a state machine actor logic creator, see {@link createMachine}. Other actor logic creators include {@link fromCallback}, {@link fromEventObservable}, {@link fromObservable}, {@link fromPromise}, and {@link fromTransition}.
 * @param options - Actor options
 */
export function createActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic>
): Actor<TLogic>;
export function createActor<TMachine extends AnyStateMachine>(
  machine: AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends true
    ? TMachine
    : MissingImplementationsError<TMachine['__TResolvedTypesMeta']>,
  options?: ActorOptions<TMachine>
): Actor<TMachine>;
export function createActor(logic: any, options?: ActorOptions<any>): any {
  const interpreter = new Actor(logic, options);

  return interpreter;
}

/**
 * Creates a new Interpreter instance for the given machine with the provided options, if any.
 *
 * @deprecated Use `createActor` instead
 */
export const interpret = createActor;

/**
 * @deprecated Use `Actor` instead.
 */
export type Interpreter = typeof Actor;
