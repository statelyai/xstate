import isDevelopment from '#is-development';
import { Mailbox } from './Mailbox.ts';
import { doneInvoke, error } from './actions.ts';
import { stopSignalType } from './actors/index.ts';
import { devToolsAdapter } from './dev/index.ts';
import { symbolObservable } from './symbolObservable.ts';
import { createSystem } from './system.ts';
import {
  AreAllImplementationsAssumedToBeProvided,
  MissingImplementationsError
} from './typegenTypes.ts';
import type {
  ActorLogic,
  ActorContext,
  ActorSystem,
  AnyActorLogic,
  AnyStateMachine,
  EventFromLogic,
  InterpreterFrom,
  PersistedStateFrom,
  RaiseActionObject,
  SnapshotFrom
} from './types.ts';
import {
  ActorRef,
  DoneEvent,
  EventObject,
  InteropSubscribable,
  InterpreterOptions,
  Observer,
  SendActionObject,
  Subscription
} from './types.ts';
import { toObserver } from './utils.ts';

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

const defaultOptions = {
  deferEvents: true,
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

type InternalStateFrom<TLogic extends ActorLogic<any, any, any>> =
  TLogic extends ActorLogic<infer _, infer __, infer TInternalState>
    ? TInternalState
    : never;

export class Interpreter<
  TLogic extends AnyActorLogic,
  TEvent extends EventObject = EventFromLogic<TLogic>
> implements ActorRef<TEvent, SnapshotFrom<TLogic>>
{
  /**
   * The current state of the interpreted logic.
   */
  private _state!: InternalStateFrom<TLogic>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;
  public options: Readonly<InterpreterOptions<TLogic>>;

  /**
   * The unique identifier for this actor relative to its parent.
   */
  public id: string;

  private mailbox: Mailbox<TEvent> = new Mailbox(this._process.bind(this));

  private delayedEventsMap: Record<string, unknown> = {};

  private observers: Set<Observer<SnapshotFrom<TLogic>>> = new Set();
  private logger: (...args: any[]) => void;
  /**
   * Whether the service is started.
   */
  public status: ActorStatus = ActorStatus.NotStarted;

  // Actor Ref
  public _parent?: ActorRef<any>;
  public ref: ActorRef<TEvent>;
  // TODO: add typings for system
  private _actorContext: ActorContext<TEvent, SnapshotFrom<TLogic>, any>;

  private _systemId: string | undefined;

  /**
   * The globally unique process ID for this invocation.
   */
  public sessionId: string;

  public system: ActorSystem<any>;
  private _doneEvent?: DoneEvent;

  public src?: string;

  /**
   * Creates a new Interpreter instance (i.e., service) for the given logic with the provided options, if any.
   *
   * @param logic The logic to be interpreted
   * @param options Interpreter options
   */
  constructor(public logic: TLogic, options?: InterpreterOptions<TLogic>) {
    const resolvedOptions = {
      ...defaultOptions,
      ...options
    };

    const { clock, logger, parent, id, systemId } = resolvedOptions;
    const self = this;

    this.system = parent?.system ?? createSystem();

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
    this._actorContext = {
      self,
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

    // Ensure that the send method is bound to this interpreter instance
    // if destructured
    this.send = this.send.bind(this);
    this._initState();
  }

  private _initState() {
    this._state = this.options.state
      ? this.logic.restoreState
        ? this.logic.restoreState(this.options.state, this._actorContext)
        : this.options.state
      : this.logic.getInitialState(this._actorContext, this.options?.input);
  }

  // array of functions to defer
  private _deferred: Array<(state: any) => void> = [];

  private update(state: InternalStateFrom<TLogic>): void {
    // Update state
    this._state = state;
    const snapshot = this.getSnapshot();

    // Execute deferred effects
    let deferredFn: (typeof this._deferred)[number] | undefined;

    while ((deferredFn = this._deferred.shift())) {
      deferredFn(state);
    }

    for (const observer of this.observers) {
      observer.next?.(snapshot);
    }

    const status = this.logic.getStatus?.(state);

    switch (status?.status) {
      case 'done':
        this._stopProcedure();
        this._doneEvent = doneInvoke(this.id, status.data);
        this._parent?.send(this._doneEvent as any);
        this._complete();
        break;
      case 'error':
        this._stopProcedure();
        this._parent?.send(error(this.id, status.data));
        this._error(status.data);
        break;
    }
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

    this.observers.add(observer);

    if (this.status === ActorStatus.Stopped) {
      observer.complete?.();
      this.observers.delete(observer);
    }

    return {
      unsubscribe: () => {
        this.observers.delete(observer);
      }
    };
  }

  /**
   * Starts the interpreter from the initial state
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

    if (this.logic.start) {
      this.logic.start(this._state, this._actorContext);
    }

    // TODO: this notifies all subscribers but usually this is redundant
    // there is no real change happening here
    // we need to rethink if this needs to be refactored
    this.update(this._state);

    if (this.options.devTools) {
      this.attachDevTools();
    }

    this.mailbox.start();

    return this;
  }

  private _process(event: TEvent) {
    try {
      const nextState = this.logic.transition(
        this._state,
        event,
        this._actorContext
      );

      this.update(nextState);

      if (event.type === stopSignalType) {
        this._stopProcedure();
        this._complete();
      }
    } catch (err) {
      // TODO: properly handle errors
      if (this.observers.size > 0) {
        this.observers.forEach((observer) => {
          observer.error?.(err);
        });
        this.stop();
      } else {
        throw err;
      }
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
    this.mailbox.enqueue({ type: stopSignalType } as any);

    return this;
  }

  /**
   * Stops the interpreter and unsubscribe all listeners.
   */
  public stop(): this {
    if (this._parent) {
      throw new Error('A non-root actor cannot be stopped directly.');
    }
    return this._stop();
  }
  private _complete(): void {
    for (const observer of this.observers) {
      observer.complete?.();
    }
    this.observers.clear();
  }
  private _error(data: any): void {
    for (const observer of this.observers) {
      observer.error?.(data);
    }
    this.observers.clear();
  }
  private _stopProcedure(): this {
    if (this.status !== ActorStatus.Running) {
      // Interpreter already stopped; do nothing
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
   * Sends an event to the running interpreter to trigger a transition.
   *
   * @param event The event to send
   */
  public send(event: TEvent) {
    if (typeof event === 'string') {
      throw new Error(
        `Only event objects may be sent to actors; use .send({ type: "${event}" }) instead`
      );
    }

    if (this.status === ActorStatus.Stopped) {
      // do nothing
      if (isDevelopment) {
        const eventString = JSON.stringify(event);

        console.warn(
          `Event "${event.type.toString()}" was sent to stopped actor "${
            this.id
          } (${
            this.sessionId
          })". This actor has already reached its final state, and will not transition.\nEvent: ${eventString}`
        );
      }
      return;
    }

    if (this.status !== ActorStatus.Running && !this.options.deferEvents) {
      throw new Error(
        `Event "${event.type}" was sent to uninitialized actor "${
          this.id
          // tslint:disable-next-line:max-line-length
        }". Make sure .start() is called for this actor, or set { deferEvents: true } in the actor options.\nEvent: ${JSON.stringify(
          event
        )}`
      );
    }

    this.mailbox.enqueue(event);
  }

  // TODO: make private (and figure out a way to do this within the machine)
  public delaySend(
    sendAction: SendActionObject | RaiseActionObject<any, any, any>
  ): void {
    this.delayedEventsMap[sendAction.params.id] = this.clock.setTimeout(() => {
      if ('to' in sendAction.params && sendAction.params.to) {
        sendAction.params.to.send(sendAction.params.event);
      } else {
        this.send(sendAction.params.event);
      }
    }, sendAction.params.delay as number);
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
      id: this.id
    };
  }

  public getPersistedState(): PersistedStateFrom<TLogic> | undefined {
    return this.logic.getPersistedState?.(this._state);
  }

  public [symbolObservable](): InteropSubscribable<SnapshotFrom<TLogic>> {
    return this;
  }

  public getSnapshot(): SnapshotFrom<TLogic> {
    return this.logic.getSnapshot
      ? this.logic.getSnapshot(this._state)
      : this._state;
  }
}

/**
 * Creates a new Interpreter instance for the given machine with the provided options, if any.
 *
 * @param machine The machine to interpret
 * @param options Interpreter options
 */
export function interpret<TMachine extends AnyStateMachine>(
  machine: AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends true
    ? TMachine
    : MissingImplementationsError<TMachine['__TResolvedTypesMeta']>,
  options?: InterpreterOptions<TMachine>
): InterpreterFrom<TMachine>;
export function interpret<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: InterpreterOptions<TLogic>
): Interpreter<TLogic>;
export function interpret(logic: any, options?: InterpreterOptions<any>): any {
  const interpreter = new Interpreter(logic, options);

  return interpreter;
}
