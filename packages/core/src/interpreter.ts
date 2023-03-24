import type {
  ActorContext,
  AnyStateMachine,
  ActorBehavior,
  EventFromBehavior,
  InterpreterFrom,
  PersistedStateFrom,
  SnapshotFrom,
  AnyActorBehavior,
  RaiseActionObject
} from './types.js';
import { stopSignalType } from './actors/index.js';
import { devToolsAdapter } from './dev/index.js';
import { IS_PRODUCTION } from './environment.js';
import { Mailbox } from './Mailbox.js';
import { registry } from './registry.js';
import { AreAllImplementationsAssumedToBeProvided } from './typegenTypes.js';
import {
  ActorRef,
  DoneEvent,
  EventObject,
  InteropSubscribable,
  InterpreterOptions,
  Observer,
  SCXML,
  SendActionObject,
  Subscription
} from './types.js';
import { toObserver, toSCXMLEvent, warn } from './utils.js';
import { symbolObservable } from './symbolObservable.js';
import { doneInvoke, error } from './actions.js';

export type SnapshotListener<TBehavior extends AnyActorBehavior> = (
  state: SnapshotFrom<TBehavior>
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

type InternalStateFrom<TBehavior extends ActorBehavior<any, any, any>> =
  TBehavior extends ActorBehavior<infer _, infer __, infer TInternalState>
    ? TInternalState
    : never;

export class Interpreter<
  TBehavior extends AnyActorBehavior,
  TEvent extends EventObject = EventFromBehavior<TBehavior>
> implements ActorRef<TEvent, SnapshotFrom<TBehavior>>
{
  /**
   * The current state of the interpreted behavior.
   */
  private _state!: InternalStateFrom<TBehavior>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;
  public options: Readonly<InterpreterOptions<TBehavior>>;

  /**
   * The unique identifier for this actor relative to its parent.
   */
  public id: string;

  private mailbox: Mailbox<SCXML.Event<TEvent>> = new Mailbox(
    this._process.bind(this)
  );

  private delayedEventsMap: Record<string, unknown> = {};

  private observers: Set<Observer<SnapshotFrom<TBehavior>>> = new Set();
  private logger: (...args: any[]) => void;
  /**
   * Whether the service is started.
   */
  public status: ActorStatus = ActorStatus.NotStarted;

  // Actor Ref
  public _parent?: ActorRef<any>;
  public ref: ActorRef<TEvent>;
  private _actorContext: ActorContext<TEvent, SnapshotFrom<TBehavior>>;

  /**
   * The globally unique process ID for this invocation.
   */
  public sessionId: string;

  private _doneEvent?: DoneEvent;

  public src?: string;

  /**
   * Creates a new Interpreter instance (i.e., service) for the given behavior with the provided options, if any.
   *
   * @param behavior The behavior to be interpreted
   * @param options Interpreter options
   */
  constructor(
    public behavior: TBehavior,
    options?: InterpreterOptions<TBehavior>
  ) {
    const resolvedOptions = {
      ...defaultOptions,
      ...options
    };

    const { clock, logger, parent, id } = resolvedOptions;
    const self = this;

    // TODO: this should come from a "system"
    this.sessionId = registry.bookId();
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
      }
    };

    // Ensure that the send method is bound to this interpreter instance
    // if destructured
    this.send = this.send.bind(this);
    this._initState();
  }

  private _initState() {
    this._state = this.options.state
      ? this.behavior.restoreState
        ? this.behavior.restoreState(this.options.state, this._actorContext)
        : this.options.state
      : this.behavior.getInitialState(this._actorContext, this.options?.input);
  }

  // array of functions to defer
  private _deferred: Array<(state: any) => void> = [];

  private update(state: InternalStateFrom<TBehavior>): void {
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

    const status = this.behavior.getStatus?.(state);

    switch (status?.status) {
      case 'done':
        this._doneEvent = doneInvoke(this.id, status.data);
        this._parent?.send(
          toSCXMLEvent(this._doneEvent as any, {
            origin: this,
            invokeid: this.id
          })
        );

        this._stop();
        break;
      case 'error':
        this._parent?.send(
          toSCXMLEvent(error(this.id, status.data), {
            origin: this
          })
        );
        for (const observer of this.observers) {
          observer.error?.(status.data);
        }
        break;
    }
  }

  public subscribe(observer: Observer<SnapshotFrom<TBehavior>>): Subscription;
  public subscribe(
    nextListener?: (state: SnapshotFrom<TBehavior>) => void,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription;
  public subscribe(
    nextListenerOrObserver?:
      | ((state: SnapshotFrom<TBehavior>) => void)
      | Observer<SnapshotFrom<TBehavior>>,
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
   * Adds a state listener that is notified when the statechart has reached its final state.
   * @param listener The state listener
   */
  public onDone(listener: EventListener<DoneEvent>): this {
    if (this.status === ActorStatus.Stopped && this._doneEvent) {
      listener(this._doneEvent);
    } else {
      this.observers.add({
        complete: () => {
          if (this._doneEvent) {
            listener(this._doneEvent);
          }
        }
      });
    }

    return this;
  }

  /**
   * Starts the interpreter from the initial state
   */
  public start(): this {
    if (this.status === ActorStatus.Running) {
      // Do not restart the service if it is already started
      return this;
    }

    registry.register(this.sessionId, this.ref);
    this.status = ActorStatus.Running;

    if (this.behavior.start) {
      this.behavior.start(this._state, this._actorContext);
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

  private _process(event: SCXML.Event<TEvent>) {
    try {
      const nextState = this.behavior.transition(
        this._state,
        event,
        this._actorContext
      );

      this.update(nextState);

      if (event.name === stopSignalType) {
        this._stop();
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

  /**
   * Stops the interpreter and unsubscribe all listeners.
   */
  public stop(): this {
    if (this.status === ActorStatus.Stopped) {
      return this;
    }
    this.mailbox.clear();
    if (this.status === ActorStatus.NotStarted) {
      this.status = ActorStatus.Stopped;
      return this;
    }
    this.mailbox.enqueue(toSCXMLEvent({ type: stopSignalType }) as any);

    return this;
  }
  private _complete(): void {
    for (const observer of this.observers) {
      observer.complete?.();
    }
    this.observers.clear();
  }
  private _stop(): this {
    this._complete();

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
    registry.free(this.sessionId);

    return this;
  }

  /**
   * Sends an event to the running interpreter to trigger a transition.
   *
   * @param event The event to send
   */
  public send(event: TEvent | SCXML.Event<TEvent>) {
    const _event = toSCXMLEvent(event);

    if (this.status === ActorStatus.Stopped) {
      // do nothing
      if (!IS_PRODUCTION) {
        const eventString = JSON.stringify(_event.data);

        warn(
          false,
          `Event "${_event.name.toString()}" was sent to stopped actor "${
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
        `Event "${_event.name}" was sent to uninitialized actor "${
          this.id
          // tslint:disable-next-line:max-line-length
        }". Make sure .start() is called for this actor, or set { deferEvents: true } in the actor options.\nEvent: ${JSON.stringify(
          _event.data
        )}`
      );
    }

    this.mailbox.enqueue(_event);
  }

  // TODO: make private (and figure out a way to do this within the machine)
  public delaySend(
    sendAction: SendActionObject | RaiseActionObject<any, any, any>
  ): void {
    this.delayedEventsMap[sendAction.params.id] = this.clock.setTimeout(() => {
      if ('to' in sendAction.params && sendAction.params.to) {
        sendAction.params.to.send(sendAction.params._event);
      } else {
        this.send(sendAction.params._event as SCXML.Event<TEvent>);
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

  public getPersistedState(): PersistedStateFrom<TBehavior> | undefined {
    return this.behavior.getPersistedState?.(this._state);
  }

  public [symbolObservable](): InteropSubscribable<SnapshotFrom<TBehavior>> {
    return this;
  }

  public getSnapshot(): SnapshotFrom<TBehavior> {
    return this.behavior.getSnapshot
      ? this.behavior.getSnapshot(this._state)
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
    : 'Some implementations missing',
  options?: InterpreterOptions<TMachine>
): InterpreterFrom<TMachine>;
export function interpret<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior,
  options?: InterpreterOptions<TBehavior>
): Interpreter<TBehavior>;
export function interpret(
  behavior: any,
  options?: InterpreterOptions<any>
): any {
  const interpreter = new Interpreter(behavior, options);

  return interpreter;
}
