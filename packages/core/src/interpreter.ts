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

export enum ActorStatus {
  NotStarted,
  Running,
  Stopped
}

/**
 * @deprecated Use `ActorStatus` instead.
 */
export const InterpreterStatus = ActorStatus;

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
  /**
   * Whether the service is started.
   */
  public status: ActorStatus = ActorStatus.NotStarted;

  // Actor Ref
  public _parent?: ActorRef<any, any>;
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

  public src?: string;

  /**
   * Creates a new actor instance for the given logic with the provided options, if any.
   *
   * @param logic The logic to create an actor from
   * @param options Actor options
   */
  constructor(public logic: TLogic, options?: ActorOptions<TLogic>) {
    const resolvedOptions = {
      ...defaultOptions,
      ...options
    } as ActorOptions<TLogic> & typeof defaultOptions;

    const { clock, logger, parent, id, systemId, inspect } = resolvedOptions;

    this.system = parent?.system ?? createSystem(this);

    if (inspect && !parent) {
      // Always inspect at the system-level
      this.system.inspect(toObserver(inspect));
    }

    if (systemId) {
      this._systemId = systemId;
      this.system._set(systemId, this);
    }

    this.sessionId = this.system._bookId();
    this.id = id ?? this.sessionId;
    this.logger = logger;
    this.clock = clock;
    this._parent = parent;
    this.options = resolvedOptions;
    this.src = resolvedOptions.src;
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
    this._initState();
  }

  private _initState() {
    this._state = this.options.state
      ? this.logic.restoreState
        ? this.logic.restoreState(this.options.state, this._actorScope)
        : this.options.state
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
      // TODO: should observers be notified in case of the error?
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

    if (this.status !== ActorStatus.Stopped) {
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
    if (this.status === ActorStatus.Running) {
      // Do not restart the service if it is already started
      return this;
    }

    this.system._register(this.sessionId, this);
    if (this._systemId) {
      this.system._set(this._systemId, this);
    }
    this.status = ActorStatus.Running;

    const initEvent = createInitEvent(this.options.input);

    this.system._sendInspectionEvent({
      type: '@xstate.event',
      sourceRef: this._parent,
      targetRef: this,
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
    if (this.status === ActorStatus.Stopped) {
      return this;
    }
    this.mailbox.clear();
    if (this.status === ActorStatus.NotStarted) {
      this.status = ActorStatus.Stopped;
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
    if (this.status !== ActorStatus.Running) {
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

    this.status = ActorStatus.Stopped;
    this.system._unregister(this);

    return this;
  }

  /**
   * @internal
   */
  public _send(event: EventFromLogic<TLogic>) {
    if (this.status === ActorStatus.Stopped) {
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

  // TODO: make private (and figure out a way to do this within the machine)
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

  public getPersistedState(): Snapshot<unknown> {
    return this.logic.getPersistedState(this._state);
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
 * Creates a new `ActorRef` instance for the given machine with the provided options, if any.
 *
 * @param machine The machine to create an actor from
 * @param options `ActorRef` options
 */
export function createActor<TMachine extends AnyStateMachine>(
  machine: AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends true
    ? TMachine
    : MissingImplementationsError<TMachine['__TResolvedTypesMeta']>,
  options?: ActorOptions<TMachine>
): Actor<TMachine>;
export function createActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic>
): Actor<TLogic>;
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
