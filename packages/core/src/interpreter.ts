import {
  ActorContext,
  ActorRefFrom,
  ActorRefFromBehavior,
  AnyState,
  AnyStateMachine,
  Behavior,
  EventFromBehavior,
  InterpreterFrom,
  SnapshotFrom,
  toObserver
} from '.';
import { doneInvoke } from './actions';
import { LifecycleSignal, startSignalType } from './actors';
import { devToolsAdapter } from './dev';
import { IS_PRODUCTION } from './environment';
import { Mailbox } from './Mailbox';
import { registry } from './registry';
import { isStateConfig, State } from './State';
import { AreAllImplementationsAssumedToBeProvided } from './typegenTypes';
import {
  ActorRef,
  DoneEvent,
  EventObject,
  InteropSubscribable,
  InterpreterOptions,
  Observer,
  SCXML,
  SendActionObject,
  StateValue,
  Subscription
} from './types';
import {
  isSCXMLErrorEvent,
  isStateLike,
  isStateMachine,
  toSCXMLEvent,
  warn
} from './utils';
import { symbolObservable } from './symbolObservable';
import { execAction } from './exec';

export type SnapshotListener<TBehavior extends Behavior<any, any>> = (
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

export enum InterpreterStatus {
  NotStarted,
  Running,
  Stopped
}

const defaultOptions: InterpreterOptions = {
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

type InternalStateFrom<
  TBehavior extends Behavior<any, any, any>
> = TBehavior extends Behavior<infer _, infer __, infer TInternalState>
  ? TInternalState
  : never;

export class Interpreter<
  TBehavior extends Behavior<any, any>,
  TEvent extends EventObject = EventFromBehavior<TBehavior>
> implements ActorRef<TEvent, SnapshotFrom<TBehavior>> {
  /**
   * The current state of the interpreted machine.
   */
  private _state?: InternalStateFrom<TBehavior>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;
  public options: Readonly<InterpreterOptions>;

  public id: string | undefined;

  private mailbox: Mailbox<SCXML.Event<TEvent>> = new Mailbox(
    this._process.bind(this)
  );

  private delayedEventsMap: Record<string, unknown> = {};

  private observers: Set<Observer<SnapshotFrom<TBehavior>>> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private doneListeners: Set<EventListener> = new Set();
  private stopListeners: Set<Listener> = new Set();
  private logger: (...args: any[]) => void;
  /**
   * Whether the service is started.
   */
  public status: InterpreterStatus = InterpreterStatus.NotStarted;

  // Actor Ref
  public _parent?: ActorRef<any>;
  public name: string;
  public ref: ActorRef<TEvent>;
  private _actorContext: ActorContext<TEvent, SnapshotFrom<TBehavior>>;

  /**
   * The globally unique process ID for this invocation.
   */
  public sessionId: string;

  // TODO: remove
  public _forwardTo: Set<string> = new Set();

  /**
   * Creates a new Interpreter instance (i.e., service) for the given machine with the provided options, if any.
   *
   * @param behavior The machine to be interpreted
   * @param options Interpreter options
   */
  constructor(public behavior: TBehavior, options?: InterpreterOptions) {
    const resolvedOptions = {
      ...defaultOptions,
      ...options
    } as Required<InterpreterOptions>;

    const { clock, logger, parent, id } = resolvedOptions;

    this.name = this.id = id;
    this.logger = logger;
    this.clock = clock;
    this._parent = parent;
    this.options = resolvedOptions;
    this.ref = this;
    // TODO: this should come from a "system"
    this.sessionId = registry.bookId();
    this._actorContext = {
      self: this,
      name: this.id ?? 'todo',
      sessionId: this.sessionId,
      logger: this.logger,
      exec: (fn) => {
        fn();
      },
      defer: (fn) => {
        this._deferred.push(fn);
      },
      observers: this.observers
    };

    // Ensure that the send method is bound to this interpreter instance
    // if destructured
    this.send = this.send.bind(this);
  }

  // array of functions to defer
  private _deferred: Array<() => void> = [];

  private __initial: InternalStateFrom<TBehavior> | undefined = undefined;

  public get initialState(): InternalStateFrom<TBehavior> {
    // TODO: getSnapshot
    return (
      this.__initial ||
      ((this.__initial =
        this.behavior.getInitialState?.(this._actorContext) ??
        this.behavior.initialState),
      this.__initial!)
    );
  }

  private update(state: InternalStateFrom<TBehavior>): void {
    // Update state
    this._state = state;
    const snapshot = this.getSnapshot();

    while (this._deferred.length) {
      this._deferred.shift()!();
    }

    for (const observer of this.observers) {
      observer.next?.(snapshot);
    }

    if (isStateMachine(this.behavior) && isStateLike(state)) {
      const isDone = (state as State<any, any>).done;

      if (isDone) {
        const output = (state as State<any, any>).output;

        const doneEvent = toSCXMLEvent(doneInvoke(this.name, output), {
          invokeid: this.name
        });

        for (const listener of this.doneListeners) {
          listener(doneEvent);
        }

        this._parent?.send(doneEvent);

        this._stop();
      }
    }
  }
  /*
   * Adds a listener that is notified whenever a state transition happens. The listener is called with
   * the next state and the event object that caused the state transition.
   *
   * @param listener The state listener
   * @deprecated Use .subscribe(listener) instead
   */
  public onTransition(listener: SnapshotListener<TBehavior>): this {
    const observer = toObserver(listener);
    this.observers.add(observer);

    // Send current state to listener
    if (this.status === InterpreterStatus.Running) {
      observer.next(this.getSnapshot());
    }

    return this;
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

    if (errorListener) {
      this.onError(errorListener);
    }

    // Send current state to listener
    if (this.status !== InterpreterStatus.NotStarted) {
      observer.next(this.getSnapshot());
    }

    const completeOnce = () => {
      this.doneListeners.delete(completeOnce);
      this.stopListeners.delete(completeOnce);
      observer.complete();
    };

    if (this.status === InterpreterStatus.Stopped) {
      observer.complete();
    } else {
      this.onDone(completeOnce);
      this.onStop(completeOnce);
    }

    return {
      unsubscribe: () => {
        this.observers.delete(observer);
        this.errorListeners.delete(observer.error);
        this.doneListeners.delete(completeOnce);
        this.stopListeners.delete(completeOnce);
      }
    };
  }

  /**

   * Adds a listener that is notified when the machine is stopped.
   *
   * @param listener The listener
   */
  public onStop(listener: Listener): this {
    this.stopListeners.add(listener);
    return this;
  }

  /**
   * Adds an error listener that is notified with an `Error` whenever an
   * error occurs during execution.
   *
   * @param listener The error listener
   */
  public onError(listener: ErrorListener): this {
    this.errorListeners.add(listener);
    return this;
  }

  /**
   * Adds a state listener that is notified when the statechart has reached its final state.
   * @param listener The state listener
   */
  public onDone(listener: EventListener<DoneEvent>): this {
    this.doneListeners.add(listener);
    return this;
  }

  /**
   * Starts the interpreter from the given state, or the initial state.
   * @param initialState The state to start the statechart from
   */
  public start(initialState?: InternalStateFrom<TBehavior> | StateValue): this {
    if (this.status === InterpreterStatus.Running) {
      // Do not restart the service if it is already started
      return this;
    }

    registry.register(this.sessionId, this.ref);
    this.status = InterpreterStatus.Running;

    let resolvedState;

    if (initialState === undefined) {
      resolvedState = this.initialState;
    } else {
      if (isStateConfig(initialState)) {
        // TODO: fix these types
        resolvedState = ((this
          .behavior as unknown) as AnyStateMachine).resolveState(
          initialState as any
        );
      } else {
        resolvedState = ((this
          .behavior as unknown) as AnyStateMachine).resolveState(
          State.from(
            initialState as any, // TODO: fix type
            ((this.behavior as unknown) as AnyStateMachine).context
          )
        );
      }

      // Re-execute actions
      if (isStateLike(resolvedState)) {
        for (const action of resolvedState.actions) {
          execAction(action, resolvedState, this._actorContext);
        }
      }
    }

    if (!isStateMachine(this.behavior)) {
      resolvedState = this.behavior.transition(
        this.behavior.initialState,
        { type: startSignalType },
        this._actorContext
      );
    }

    // TODO: this notifies all subscribers but usually this is redundant
    // if we are using the initialState as `resolvedState` then there is no real change happening here
    // we need to rethink if this needs to be refactored
    this.update(resolvedState);

    if (this.options.devTools) {
      this.attachDevTools();
    }

    this.mailbox.start();

    return this;
  }

  private _process(event: SCXML.Event<TEvent>) {
    // TODO: handle errors
    this.forward(event);

    let errored = false;

    const snapshot = this.getSnapshot();

    if (
      isStateLike(snapshot) &&
      isSCXMLErrorEvent(event) &&
      !(snapshot as AnyState).nextEvents.some(
        (nextEvent) => nextEvent === event.name
      )
    ) {
      errored = true;
      // Error event unhandled by machine
      if (this.errorListeners.size > 0) {
        this.errorListeners.forEach((listener) => {
          listener(event.data.data);
        });
      } else {
        this.stop();

        // TODO: improve this
        throw event.data.data;
      }
    }

    const nextState = this._nextState(event);

    this.update(nextState);

    if (event.name === 'xstate.stop') {
      this._stop();
    } else if (errored) {
      this.stop();
    }
  }

  /**
   * Stops the interpreter and unsubscribe all listeners.
   *
   * This will also notify the `onStop` listeners.
   */
  public stop(): this {
    delete this.__initial;
    // const mailbox = this.mailbox;

    // this._stop();
    this.mailbox.clear();
    this.mailbox.enqueue(toSCXMLEvent({ type: 'xstate.stop' }) as any);

    return this;
  }
  private _stop(): this {
    this.observers.clear();
    for (const listener of this.stopListeners) {
      // call listener, then remove
      listener();
    }
    this.stopListeners.clear();
    this.doneListeners.clear();

    if (this.status !== InterpreterStatus.Running) {
      // Interpreter already stopped; do nothing
      return this;
    }

    // Cancel all delayed events
    for (const key of Object.keys(this.delayedEventsMap)) {
      this.clock.clearTimeout(this.delayedEventsMap[key]);
    }

    this.mailbox.clear();
    // TODO: after `stop` we must prepare ourselves for receiving events again
    // events sent *after* stop signal must be queued
    // it seems like this should be the common behavior for all of our consumers
    // so perhaps this should be unified somehow for all of them
    this.mailbox = new Mailbox(this._process.bind(this));

    this.status = InterpreterStatus.Stopped;
    registry.free(this.sessionId);

    return this;
  }

  /**
   * Sends an event to the running interpreter to trigger a transition.
   *
   * An array of events (batched) can be sent as well, which will send all
   * batched events to the running interpreter. The listeners will be
   * notified only **once** when all events are processed.
   *
   * @param event The event(s) to send
   */
  public send(event: TEvent | SCXML.Event<TEvent>) {
    const _event = toSCXMLEvent(event);

    if (this.status === InterpreterStatus.Stopped) {
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

    if (
      this.status !== InterpreterStatus.Running &&
      !this.options.deferEvents
    ) {
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

  /**
   * Returns the next state given the interpreter's current state and the event.
   *
   * This is a pure method that does _not_ update the interpreter's state.
   *
   * @param event The event to determine the next state
   */
  public nextState(
    event: TEvent | SCXML.Event<TEvent> | LifecycleSignal
  ): InternalStateFrom<TBehavior> {
    return this.behavior.transition(this._state, event, {
      ...this._actorContext,
      exec: undefined
    });
  }
  private _nextState(
    event: TEvent | SCXML.Event<TEvent> | LifecycleSignal
  ): InternalStateFrom<TBehavior> {
    return this.behavior.transition(this._state, event, this._actorContext);
  }
  private forward(event: SCXML.Event<TEvent>): void {
    const snapshot = this.getSnapshot();
    if (!isStateLike(snapshot)) {
      return;
    }

    for (const id of this._forwardTo) {
      const child = (snapshot as AnyState).children[id];

      if (!child) {
        throw new Error(
          `Unable to forward event '${event.name}' from interpreter '${this.name}' to nonexistant child '${id}'.`
        );
      }

      child.send(event);
    }
  }
  // TODO: make private (and figure out a way to do this within the machine)
  public defer(sendAction: SendActionObject): void {
    this.delayedEventsMap[sendAction.params.id] = this.clock.setTimeout(() => {
      if (sendAction.params.to) {
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
      id: this.name
    };
  }

  public [symbolObservable](): InteropSubscribable<SnapshotFrom<TBehavior>> {
    return this;
  }

  public getSnapshot() {
    const getter = this.behavior.getSnapshot ?? ((s) => s);
    if (this.status === InterpreterStatus.NotStarted) {
      return getter(this.initialState);
    }
    return getter(this._state!);
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
  options?: InterpreterOptions
): InterpreterFrom<TMachine>;
export function interpret<TBehavior extends Behavior<any, any>>(
  machine: TBehavior,
  options?: InterpreterOptions
): Interpreter<TBehavior>;
export function interpret(machine: any, options?: InterpreterOptions): any {
  const resolvedOptions = {
    id: isStateMachine(machine) ? machine.key : undefined,
    ...options
  };

  const interpreter = new Interpreter(machine, resolvedOptions);

  return interpreter as any;
}
