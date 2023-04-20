import {
  StateMachine,
  Event,
  EventObject,
  CancelAction,
  DefaultContext,
  ActionObject,
  StateSchema,
  ActivityActionObject,
  SpecialTargets,
  ActionTypes,
  InvokeDefinition,
  SendActionObject,
  InvokeCallback,
  DisposeActivityFunction,
  StateValue,
  InterpreterOptions,
  ActivityDefinition,
  SingleOrArray,
  Subscribable,
  DoneEvent,
  MachineOptions,
  SCXML,
  EventData,
  Observer,
  Spawnable,
  Typestate,
  AnyEventObject,
  AnyInterpreter,
  ActorRef,
  ActorRefFrom,
  Behavior,
  Subscription,
  AnyState,
  StateConfig,
  InteropSubscribable,
  RaiseActionObject,
  LogActionObject
} from './types';
import { State, bindActionToState, isStateConfig } from './State';
import * as actionTypes from './actionTypes';
import {
  doneInvoke,
  error,
  getActionFunction,
  initEvent,
  resolveActions,
  toActionObjects
} from './actions';
import { IS_PRODUCTION } from './environment';
import {
  isPromiseLike,
  mapContext,
  warn,
  isArray,
  isFunction,
  isString,
  isObservable,
  uniqueId,
  isMachine,
  toEventObject,
  toSCXMLEvent,
  reportUnhandledExceptionOnInvocation,
  toInvokeSource,
  toObserver,
  isActor,
  isBehavior,
  symbolObservable,
  flatten,
  isRaisableAction
} from './utils';
import { Scheduler } from './scheduler';
import { Actor, isSpawnedActor, createDeferredActor } from './Actor';
import { registry } from './registry';
import { getGlobal, registerService } from './devTools';
import * as serviceScope from './serviceScope';
import { spawnBehavior } from './behaviors';
import {
  AreAllImplementationsAssumedToBeProvided,
  MissingImplementationsError,
  TypegenDisabled
} from './typegenTypes';

export type StateListener<
  TContext,
  TEvent extends EventObject,
  TStateSchema extends StateSchema<TContext> = any,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TResolvedTypesMeta = TypegenDisabled
> = (
  state: State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta>,
  event: TEvent
) => void;

export type ContextListener<TContext = DefaultContext> = (
  context: TContext,
  prevContext: TContext | undefined
) => void;

export type EventListener<TEvent extends EventObject = EventObject> = (
  event: TEvent
) => void;

export type Listener = () => void;

export interface Clock {
  setTimeout(fn: (...args: any[]) => void, timeout: number): any;
  clearTimeout(id: any): void;
}

interface SpawnOptions {
  name?: string;
  autoForward?: boolean;
  sync?: boolean;
}

const DEFAULT_SPAWN_OPTIONS = { sync: false, autoForward: false };

export enum InterpreterStatus {
  NotStarted,
  Running,
  Stopped
}

export class Interpreter<
  // tslint:disable-next-line:max-classes-per-file
  TContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TResolvedTypesMeta = TypegenDisabled
> implements
    ActorRef<
      TEvent,
      State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta>
    >
{
  /**
   * The default interpreter options:
   *
   * - `clock` uses the global `setTimeout` and `clearTimeout` functions
   * - `logger` uses the global `console.log()` method
   */
  public static defaultOptions = {
    execute: true,
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
  /**
   * The current state of the interpreted machine.
   */
  private _state?: State<
    TContext,
    TEvent,
    TStateSchema,
    TTypestate,
    TResolvedTypesMeta
  >;
  private _initialState?: State<
    TContext,
    TEvent,
    TStateSchema,
    TTypestate,
    TResolvedTypesMeta
  >;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;
  public options: Readonly<InterpreterOptions>;

  private scheduler: Scheduler;
  private delayedEventsMap: Record<string, unknown> = {};
  private listeners: Set<
    StateListener<
      TContext,
      TEvent,
      TStateSchema,
      TTypestate,
      TResolvedTypesMeta
    >
  > = new Set();
  private contextListeners: Set<ContextListener<TContext>> = new Set();
  private stopListeners: Set<Listener> = new Set();
  private doneListeners: Set<EventListener> = new Set();
  private eventListeners: Set<EventListener> = new Set();
  private sendListeners: Set<EventListener> = new Set();
  private logger: (...args: any[]) => void;
  /**
   * Whether the service is started.
   */
  public initialized = false;
  public status: InterpreterStatus = InterpreterStatus.NotStarted;

  // Actor
  public parent?: Interpreter<any>;
  public id: string;

  /**
   * The globally unique process ID for this invocation.
   */
  public sessionId: string;
  public children: Map<string | number, ActorRef<any>> = new Map();
  private forwardTo: Set<string> = new Set();

  private _outgoingQueue: Array<[{ send: (ev: unknown) => void }, unknown]> =
    [];

  // Dev Tools
  private devTools?: any;
  private _doneEvent?: DoneEvent;

  /**
   * Creates a new Interpreter instance (i.e., service) for the given machine with the provided options, if any.
   *
   * @param machine The machine to be interpreted
   * @param options Interpreter options
   */
  constructor(
    public machine: StateMachine<
      TContext,
      TStateSchema,
      TEvent,
      TTypestate,
      any,
      any,
      TResolvedTypesMeta
    >,
    options: InterpreterOptions = Interpreter.defaultOptions
  ) {
    const resolvedOptions = {
      ...Interpreter.defaultOptions,
      ...options
    };

    const { clock, logger, parent, id } = resolvedOptions;

    const resolvedId = id !== undefined ? id : machine.id;

    this.id = resolvedId;
    this.logger = logger;
    this.clock = clock;
    this.parent = parent;

    this.options = resolvedOptions;

    this.scheduler = new Scheduler({
      deferEvents: this.options.deferEvents
    });

    this.sessionId = registry.bookId();
  }
  public get initialState(): State<
    TContext,
    TEvent,
    TStateSchema,
    TTypestate,
    TResolvedTypesMeta
  > {
    if (this._initialState) {
      return this._initialState;
    }

    return serviceScope.provide(this, () => {
      this._initialState = this.machine.initialState;
      return this._initialState;
    });
  }
  /**
   * @deprecated Use `.getSnapshot()` instead.
   */
  public get state(): State<
    TContext,
    TEvent,
    TStateSchema,
    TTypestate,
    TResolvedTypesMeta
  > {
    if (!IS_PRODUCTION) {
      warn(
        this.status !== InterpreterStatus.NotStarted,
        `Attempted to read state from uninitialized service '${this.id}'. Make sure the service is started first.`
      );
    }

    return this._state!;
  }
  public static interpret = interpret;
  /**
   * Executes the actions of the given state, with that state's `context` and `event`.
   *
   * @param state The state whose actions will be executed
   * @param actionsConfig The action implementations to use
   */
  public execute(
    state: State<
      TContext,
      TEvent,
      TStateSchema,
      TTypestate,
      TResolvedTypesMeta
    >,
    actionsConfig?: MachineOptions<TContext, TEvent>['actions']
  ): void {
    for (const action of state.actions) {
      this.exec(action, state, actionsConfig);
    }
  }

  private update(
    state: State<TContext, TEvent, TStateSchema, TTypestate, any>,
    _event: SCXML.Event<TEvent>
  ): void {
    // Attach session ID to state
    state._sessionid = this.sessionId;

    // Update state
    this._state = state;

    // Execute actions
    if (
      (!this.machine.config.predictableActionArguments ||
        // this is currently required to execute initial actions as the `initialState` gets cached
        // we can't just recompute it (and execute actions while doing so) because we try to preserve identity of actors created within initial assigns
        _event === initEvent) &&
      this.options.execute
    ) {
      this.execute(this.state);
    } else {
      let item: (typeof this._outgoingQueue)[number] | undefined;
      while ((item = this._outgoingQueue.shift())) {
        item[0].send(item[1]);
      }
    }

    // Update children
    this.children.forEach((child) => {
      this.state.children[child.id] = child;
    });

    // Dev tools
    if (this.devTools) {
      this.devTools.send(_event.data, state);
    }

    // Execute listeners
    if (state.event) {
      for (const listener of this.eventListeners) {
        listener(state.event);
      }
    }

    for (const listener of this.listeners) {
      listener(state, state.event);
    }

    for (const contextListener of this.contextListeners) {
      contextListener(
        this.state.context,
        this.state.history ? this.state.history.context : undefined
      );
    }

    if (this.state.done) {
      // get final child state node
      const finalChildStateNode = state.configuration.find(
        (sn) => sn.type === 'final' && sn.parent === (this.machine as any)
      );

      const doneData =
        finalChildStateNode && finalChildStateNode.doneData
          ? mapContext(finalChildStateNode.doneData, state.context, _event)
          : undefined;

      this._doneEvent = doneInvoke(this.id, doneData);

      for (const listener of this.doneListeners) {
        listener(this._doneEvent);
      }
      this._stop();
      this._stopChildren();
      registry.free(this.sessionId);
    }
  }
  /*
   * Adds a listener that is notified whenever a state transition happens. The listener is called with
   * the next state and the event object that caused the state transition.
   *
   * @param listener The state listener
   */
  public onTransition(
    listener: StateListener<
      TContext,
      TEvent,
      TStateSchema,
      TTypestate,
      TResolvedTypesMeta
    >
  ): this {
    this.listeners.add(listener);

    // Send current state to listener
    if (this.status === InterpreterStatus.Running) {
      listener(this.state, this.state.event);
    }

    return this;
  }
  public subscribe(
    observer: Partial<
      Observer<State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta>>
    >
  ): Subscription;
  public subscribe(
    nextListener?: (
      state: State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta>
    ) => void,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription;
  public subscribe(
    nextListenerOrObserver?:
      | ((
          state: State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta>
        ) => void)
      | Partial<
          Observer<State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta>>
        >,
    _?: (error: any) => void, // TODO: error listener
    completeListener?: () => void
  ): Subscription {
    const observer = toObserver(nextListenerOrObserver, _, completeListener);

    this.listeners.add(observer.next);

    // Send current state to listener
    if (this.status !== InterpreterStatus.NotStarted) {
      observer.next(this.state);
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
        this.listeners.delete(observer.next);
        this.doneListeners.delete(completeOnce);
        this.stopListeners.delete(completeOnce);
      }
    };
  }

  /**
   * Adds an event listener that is notified whenever an event is sent to the running interpreter.
   * @param listener The event listener
   */
  public onEvent(listener: EventListener): this {
    this.eventListeners.add(listener);
    return this;
  }
  /**
   * Adds an event listener that is notified whenever a `send` event occurs.
   * @param listener The event listener
   */
  public onSend(listener: EventListener): this {
    this.sendListeners.add(listener);
    return this;
  }
  /**
   * Adds a context listener that is notified whenever the state context changes.
   * @param listener The context listener
   */
  public onChange(listener: ContextListener<TContext>): this {
    this.contextListeners.add(listener);
    return this;
  }
  /**
   * Adds a listener that is notified when the machine is stopped.
   * @param listener The listener
   */
  public onStop(listener: Listener): this {
    this.stopListeners.add(listener);
    return this;
  }
  /**
   * Adds a state listener that is notified when the statechart has reached its final state.
   * @param listener The state listener
   */
  public onDone(listener: EventListener<DoneEvent>): this {
    if (this.status === InterpreterStatus.Stopped && this._doneEvent) {
      listener(this._doneEvent);
    } else {
      this.doneListeners.add(listener);
    }
    return this;
  }
  /**
   * Removes a listener.
   * @param listener The listener to remove
   */
  public off(listener: (...args: any[]) => void): this {
    this.listeners.delete(listener);
    this.eventListeners.delete(listener);
    this.sendListeners.delete(listener);
    this.stopListeners.delete(listener);
    this.doneListeners.delete(listener);
    this.contextListeners.delete(listener);
    return this;
  }
  /**
   * Alias for Interpreter.prototype.start
   */
  public init = this.start;
  /**
   * Starts the interpreter from the given state, or the initial state.
   * @param initialState The state to start the statechart from
   */
  public start(
    initialState?:
      | State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta>
      | StateConfig<TContext, TEvent>
      | StateValue
  ): this {
    if (this.status === InterpreterStatus.Running) {
      // Do not restart the service if it is already started
      return this;
    }

    // yes, it's a hack but we need the related cache to be populated for some things to work (like delayed transitions)
    // this is usually called by `machine.getInitialState` but if we rehydrate from a state we might bypass this call
    // we also don't want to call this method here as it resolves the full initial state which might involve calling assign actions
    // and that could potentially lead to some unwanted side-effects (even such as creating some rogue actors)
    (this.machine as any)._init();

    registry.register(this.sessionId, this as Actor);
    this.initialized = true;
    this.status = InterpreterStatus.Running;

    const resolvedState =
      initialState === undefined
        ? this.initialState
        : serviceScope.provide(this, () => {
            return isStateConfig<TContext, TEvent>(initialState)
              ? this.machine.resolveState(initialState)
              : this.machine.resolveState(
                  State.from(initialState, this.machine.context)
                );
          });

    if (this.options.devTools) {
      this.attachDev();
    }
    this.scheduler.initialize(() => {
      this.update(resolvedState, initEvent as SCXML.Event<TEvent>);
    });
    return this;
  }
  private _stopChildren() {
    // TODO: think about converting those to actions
    this.children.forEach((child) => {
      if (isFunction(child.stop)) {
        child.stop();
      }
    });
    this.children.clear();
  }
  private _stop() {
    for (const listener of this.listeners) {
      this.listeners.delete(listener);
    }
    for (const listener of this.stopListeners) {
      // call listener, then remove
      listener();
      this.stopListeners.delete(listener);
    }
    for (const listener of this.contextListeners) {
      this.contextListeners.delete(listener);
    }
    for (const listener of this.doneListeners) {
      this.doneListeners.delete(listener);
    }

    if (!this.initialized) {
      // Interpreter already stopped; do nothing
      return this;
    }

    this.initialized = false;
    this.status = InterpreterStatus.Stopped;
    this._initialState = undefined;

    // we are going to stop within the current sync frame
    // so we can safely just cancel this here as nothing async should be fired anyway
    for (const key of Object.keys(this.delayedEventsMap)) {
      this.clock.clearTimeout(this.delayedEventsMap[key]);
    }

    // clear everything that might be enqueued
    this.scheduler.clear();

    this.scheduler = new Scheduler({
      deferEvents: this.options.deferEvents
    });
  }
  /**
   * Stops the interpreter and unsubscribe all listeners.
   *
   * This will also notify the `onStop` listeners.
   */
  public stop(): this {
    // TODO: add warning for stopping non-root interpreters

    // grab the current scheduler as it will be replaced in _stop
    const scheduler = this.scheduler;

    this._stop();

    // let what is currently processed to be finished
    scheduler.schedule(() => {
      // it feels weird to handle this here but we need to handle this even slightly "out of band"
      const _event = toSCXMLEvent({ type: 'xstate.stop' }) as any;

      const nextState = serviceScope.provide(this, () => {
        const exitActions = flatten(
          [...this.state.configuration]
            .sort((a, b) => b.order - a.order)
            .map((stateNode) =>
              toActionObjects(
                stateNode.onExit,
                this.machine.options.actions as any
              )
            )
        );

        const [resolvedActions, updatedContext] = resolveActions(
          this.machine as any,
          this.state,
          this.state.context,
          _event,
          [
            {
              type: 'exit',
              actions: exitActions
            }
          ],
          this.machine.config.predictableActionArguments
            ? this._exec
            : undefined,
          this.machine.config.predictableActionArguments ||
            this.machine.config.preserveActionOrder
        );

        const newState = new State<TContext, TEvent, TStateSchema, TTypestate>({
          value: this.state.value,
          context: updatedContext,
          _event,
          _sessionid: this.sessionId,
          historyValue: undefined,
          history: this.state,
          actions: resolvedActions.filter(
            (action) => !isRaisableAction(action)
          ),
          activities: {},
          events: [],
          configuration: [],
          transitions: [],
          children: {},
          done: this.state.done,
          tags: this.state.tags,
          machine: this.machine
        });
        newState.changed = true;
        return newState;
      });

      this.update(nextState, _event);
      this._stopChildren();

      registry.free(this.sessionId);
    });

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
  public send = (
    event: SingleOrArray<Event<TEvent>> | SCXML.Event<TEvent>,
    payload?: EventData
  ): State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta> => {
    if (isArray(event)) {
      this.batch(event);
      return this.state;
    }

    const _event = toSCXMLEvent(toEventObject(event as Event<TEvent>, payload));

    if (this.status === InterpreterStatus.Stopped) {
      // do nothing
      if (!IS_PRODUCTION) {
        warn(
          false,
          `Event "${_event.name}" was sent to stopped service "${
            this.machine.id
          }". This service has already reached its final state, and will not transition.\nEvent: ${JSON.stringify(
            _event.data
          )}`
        );
      }
      return this.state;
    }

    if (
      this.status !== InterpreterStatus.Running &&
      !this.options.deferEvents
    ) {
      throw new Error(
        `Event "${_event.name}" was sent to uninitialized service "${
          this.machine.id
          // tslint:disable-next-line:max-line-length
        }". Make sure .start() is called for this service, or set { deferEvents: true } in the service options.\nEvent: ${JSON.stringify(
          _event.data
        )}`
      );
    }

    this.scheduler.schedule(() => {
      // Forward copy of event to child actors
      this.forward(_event);

      const nextState = this._nextState(_event);

      this.update(nextState, _event);
    });

    return this._state!; // TODO: deprecate (should return void)
    // tslint:disable-next-line:semicolon
  };

  private batch(events: Array<TEvent | TEvent['type']>): void {
    if (
      this.status === InterpreterStatus.NotStarted &&
      this.options.deferEvents
    ) {
      // tslint:disable-next-line:no-console
      if (!IS_PRODUCTION) {
        warn(
          false,
          `${events.length} event(s) were sent to uninitialized service "${
            this.machine.id
          }" and are deferred. Make sure .start() is called for this service.\nEvent: ${JSON.stringify(
            event
          )}`
        );
      }
    } else if (this.status !== InterpreterStatus.Running) {
      throw new Error(
        // tslint:disable-next-line:max-line-length
        `${events.length} event(s) were sent to uninitialized service "${this.machine.id}". Make sure .start() is called for this service, or set { deferEvents: true } in the service options.`
      );
    }

    if (!events.length) {
      return;
    }

    const exec = !!this.machine.config.predictableActionArguments && this._exec;

    this.scheduler.schedule(() => {
      let nextState = this.state;
      let batchChanged = false;
      const batchedActions: Array<ActionObject<TContext, TEvent>> = [];
      for (const event of events) {
        const _event = toSCXMLEvent(event);

        this.forward(_event);

        nextState = serviceScope.provide(this, () => {
          return this.machine.transition(
            nextState,
            _event,
            undefined,
            exec || undefined
          );
        });

        batchedActions.push(
          ...(this.machine.config.predictableActionArguments
            ? nextState.actions
            : (nextState.actions.map((a) =>
                bindActionToState(a, nextState)
              ) as Array<ActionObject<TContext, TEvent>>))
        );

        batchChanged = batchChanged || !!nextState.changed;
      }

      nextState.changed = batchChanged;
      nextState.actions = batchedActions;
      this.update(nextState, toSCXMLEvent(events[events.length - 1]));
    });
  }

  /**
   * Returns a send function bound to this interpreter instance.
   *
   * @param event The event to be sent by the sender.
   */
  public sender(
    event: Event<TEvent>
  ): () => State<TContext, TEvent, TStateSchema, TTypestate> {
    return this.send.bind(this, event);
  }

  private sendTo = (
    event: SCXML.Event<AnyEventObject>,
    to: string | number | ActorRef<any>,
    immediate: boolean
  ) => {
    const isParent =
      this.parent && (to === SpecialTargets.Parent || this.parent.id === to);
    const target = isParent
      ? this.parent
      : isString(to)
      ? to === SpecialTargets.Internal
        ? this
        : this.children.get(to as string) || registry.get(to as string)
      : isActor(to)
      ? to
      : undefined;

    if (!target) {
      if (!isParent) {
        throw new Error(
          `Unable to send event to child '${to}' from service '${this.id}'.`
        );
      }

      // tslint:disable-next-line:no-console
      if (!IS_PRODUCTION) {
        warn(
          false,
          `Service '${this.id}' has no parent: unable to send event ${event.type}`
        );
      }
      return;
    }

    if ('machine' in target) {
      // perhaps those events should be rejected in the parent
      // but atm it doesn't have easy access to all of the information that is required to do it reliably
      if (
        this.status !== InterpreterStatus.Stopped ||
        this.parent !== target ||
        // we need to send events to the parent from exit handlers of a machine that reached its final state
        this.state.done
      ) {
        // Send SCXML events to machines
        const scxmlEvent = {
          ...event,
          name:
            event.name === actionTypes.error ? `${error(this.id)}` : event.name,
          origin: this.sessionId
        };
        if (!immediate && this.machine.config.predictableActionArguments) {
          this._outgoingQueue.push([target, scxmlEvent]);
        } else {
          (target as AnyInterpreter).send(scxmlEvent);
        }
      }
    } else {
      // Send normal events to other targets
      if (!immediate && this.machine.config.predictableActionArguments) {
        this._outgoingQueue.push([target, event.data]);
      } else {
        target.send(event.data);
      }
    }
  };

  private _nextState(
    event: Event<TEvent> | SCXML.Event<TEvent>,
    exec = !!this.machine.config.predictableActionArguments && this._exec
  ) {
    const _event = toSCXMLEvent(event);

    if (
      _event.name.indexOf(actionTypes.errorPlatform) === 0 &&
      !this.state.nextEvents.some(
        (nextEvent) => nextEvent.indexOf(actionTypes.errorPlatform) === 0
      )
    ) {
      throw (_event.data as any).data;
    }

    const nextState = serviceScope.provide(this, () => {
      return this.machine.transition(
        this.state,
        _event,
        undefined,
        exec || undefined
      );
    });

    return nextState;
  }

  /**
   * Returns the next state given the interpreter's current state and the event.
   *
   * This is a pure method that does _not_ update the interpreter's state.
   *
   * @param event The event to determine the next state
   */
  public nextState(
    event: Event<TEvent> | SCXML.Event<TEvent>
  ): State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta> {
    return this._nextState(event, false);
  }

  private forward(event: SCXML.Event<TEvent>): void {
    for (const id of this.forwardTo) {
      const child = this.children.get(id);

      if (!child) {
        throw new Error(
          `Unable to forward event '${event}' from interpreter '${this.id}' to nonexistant child '${id}'.`
        );
      }

      child.send(event);
    }
  }
  private defer(
    sendAction:
      | SendActionObject<TContext, TEvent>
      | RaiseActionObject<TContext, TEvent>
  ): void {
    const timerId = this.clock.setTimeout(() => {
      if ('to' in sendAction && sendAction.to) {
        this.sendTo(sendAction._event, sendAction.to, true);
      } else {
        this.send(
          (sendAction as SendActionObject<TContext, TEvent, TEvent>)._event
        );
      }
    }, sendAction.delay as number);

    if (sendAction.id) {
      this.delayedEventsMap[sendAction.id] = timerId;
    }
  }
  private cancel(sendId: string | number): void {
    this.clock.clearTimeout(this.delayedEventsMap[sendId]);
    delete this.delayedEventsMap[sendId];
  }

  private _exec = (
    action: ActionObject<TContext, TEvent>,
    context: TContext,
    _event: SCXML.Event<TEvent>,
    actionFunctionMap = this.machine.options.actions
  ): void => {
    const actionOrExec =
      action.exec || getActionFunction(action.type, actionFunctionMap as any);
    const exec = isFunction(actionOrExec)
      ? actionOrExec
      : actionOrExec
      ? (actionOrExec as any).exec
      : action.exec;

    if (exec) {
      try {
        return (exec as any)(
          context,
          _event.data,
          !this.machine.config.predictableActionArguments
            ? {
                action,
                state: this.state,
                _event
              }
            : {
                action,
                _event
              }
        );
      } catch (err) {
        if (this.parent) {
          this.parent.send({
            type: 'xstate.error',
            data: err
          } as EventObject);
        }

        throw err;
      }
    }

    switch (action.type) {
      case actionTypes.raise: {
        // if raise action reached the interpreter then it's a delayed one
        const sendAction = action as RaiseActionObject<TContext, TEvent>;
        this.defer(sendAction);
        break;
      }

      case actionTypes.send:
        const sendAction = action as SendActionObject<TContext, TEvent>;

        if (typeof sendAction.delay === 'number') {
          this.defer(sendAction);
          return;
        } else {
          if (sendAction.to) {
            this.sendTo(sendAction._event, sendAction.to, _event === initEvent);
          } else {
            this.send(
              (sendAction as SendActionObject<TContext, TEvent, TEvent>)._event
            );
          }
        }
        break;

      case actionTypes.cancel:
        this.cancel((action as CancelAction<any, any>).sendId);

        break;
      case actionTypes.start: {
        if (this.status !== InterpreterStatus.Running) {
          return;
        }
        const activity = (action as ActivityActionObject<TContext, TEvent>)
          .activity as InvokeDefinition<TContext, TEvent>;

        // If the activity will be stopped right after it's started
        // (such as in transient states)
        // don't bother starting the activity.
        if (
          // in v4 with `predictableActionArguments` invokes are called eagerly when the `this.state` still points to the previous state
          !this.machine.config.predictableActionArguments &&
          !this.state.activities[activity.id || activity.type]
        ) {
          break;
        }

        // Invoked services
        if (activity.type === ActionTypes.Invoke) {
          const invokeSource = toInvokeSource(activity.src);
          const serviceCreator = this.machine.options.services
            ? this.machine.options.services[invokeSource.type]
            : undefined;

          const { id, data } = activity;

          if (!IS_PRODUCTION) {
            warn(
              !('forward' in activity),
              // tslint:disable-next-line:max-line-length
              `\`forward\` property is deprecated (found in invocation of '${activity.src}' in in machine '${this.machine.id}'). ` +
                `Please use \`autoForward\` instead.`
            );
          }

          const autoForward =
            'autoForward' in activity
              ? activity.autoForward
              : !!activity.forward;

          if (!serviceCreator) {
            // tslint:disable-next-line:no-console
            if (!IS_PRODUCTION) {
              warn(
                false,
                `No service found for invocation '${activity.src}' in machine '${this.machine.id}'.`
              );
            }
            return;
          }

          const resolvedData = data
            ? mapContext(data, context, _event)
            : undefined;

          if (typeof serviceCreator === 'string') {
            // TODO: warn
            return;
          }

          let source: Spawnable = isFunction(serviceCreator)
            ? (serviceCreator as any)(context, _event.data, {
                data: resolvedData,
                src: invokeSource,
                meta: activity.meta
              })
            : serviceCreator;

          if (!source) {
            // TODO: warn?
            return;
          }

          let options: SpawnOptions | undefined;

          if (isMachine(source)) {
            source = resolvedData ? source.withContext(resolvedData) : source;
            options = {
              autoForward
            };
          }

          this.spawn(source, id, options);
        } else {
          this.spawnActivity(activity);
        }

        break;
      }
      case actionTypes.stop: {
        this.stopChild((action as any).activity.id);
        break;
      }

      case actionTypes.log:
        const { label, value } = action as LogActionObject<TContext, TEvent>;

        if (label) {
          this.logger(label, value);
        } else {
          this.logger(value);
        }
        break;
      default:
        if (!IS_PRODUCTION) {
          warn(
            false,
            `No implementation found for action type '${action.type}'`
          );
        }
        break;
    }
  };

  private exec(
    action: ActionObject<TContext, TEvent>,
    state: State<
      TContext,
      TEvent,
      TStateSchema,
      TTypestate,
      TResolvedTypesMeta
    >,
    actionFunctionMap = this.machine.options.actions
  ) {
    this._exec(action, state.context, state._event, actionFunctionMap);
  }

  private removeChild(childId: string): void {
    this.children.delete(childId);
    this.forwardTo.delete(childId);

    // this.state might not exist at the time this is called,
    // such as when a child is added then removed while initializing the state
    delete this.state?.children[childId];
  }

  private stopChild(childId: string): void {
    const child = this.children.get(childId);
    if (!child) {
      return;
    }

    this.removeChild(childId);

    if (isFunction(child.stop)) {
      child.stop();
    }
  }
  public spawn(
    entity: Spawnable,
    name: string,
    options?: SpawnOptions
  ): ActorRef<any> {
    if (this.status !== InterpreterStatus.Running) {
      return createDeferredActor(entity, name);
    }
    if (isPromiseLike(entity)) {
      return this.spawnPromise(Promise.resolve(entity), name);
    } else if (isFunction(entity)) {
      return this.spawnCallback(entity as InvokeCallback, name);
    } else if (isSpawnedActor(entity)) {
      return this.spawnActor(entity, name);
    } else if (isObservable<TEvent>(entity)) {
      return this.spawnObservable(entity, name);
    } else if (isMachine(entity)) {
      return this.spawnMachine(entity, { ...options, id: name });
    } else if (isBehavior(entity)) {
      return this.spawnBehavior(entity, name);
    } else {
      throw new Error(
        `Unable to spawn entity "${name}" of type "${typeof entity}".`
      );
    }
  }
  public spawnMachine<
    TChildContext,
    TChildStateSchema extends StateSchema,
    TChildEvent extends EventObject
  >(
    machine: StateMachine<TChildContext, TChildStateSchema, TChildEvent>,
    options: { id?: string; autoForward?: boolean; sync?: boolean } = {}
  ): ActorRef<TChildEvent, State<TChildContext, TChildEvent>> {
    const childService = new Interpreter(machine, {
      ...this.options, // inherit options from this interpreter
      parent: this,
      id: options.id || machine.id
    });

    const resolvedOptions = {
      ...DEFAULT_SPAWN_OPTIONS,
      ...options
    };

    if (resolvedOptions.sync) {
      childService.onTransition((state) => {
        this.send(actionTypes.update as any, {
          state,
          id: childService.id
        });
      });
    }

    const actor = childService;

    this.children.set(childService.id, actor);

    if (resolvedOptions.autoForward) {
      this.forwardTo.add(childService.id);
    }

    childService
      .onDone((doneEvent) => {
        this.removeChild(childService.id);
        this.send(toSCXMLEvent(doneEvent as any, { origin: childService.id }));
      })
      .start();

    return actor as ActorRef<
      TChildEvent,
      State<TChildContext, TChildEvent, any, any, any>
    >;
  }
  private spawnBehavior<TActorEvent extends EventObject, TEmitted>(
    behavior: Behavior<TActorEvent, TEmitted>,
    id: string
  ): ActorRef<TActorEvent, TEmitted> {
    const actorRef = spawnBehavior(behavior, { id, parent: this });

    this.children.set(id, actorRef);

    return actorRef;
  }
  private spawnPromise<T>(promise: Promise<T>, id: string): ActorRef<never, T> {
    let canceled = false;
    let resolvedData: T | undefined;

    promise.then(
      (response) => {
        if (!canceled) {
          resolvedData = response;
          this.removeChild(id);
          this.send(
            toSCXMLEvent(doneInvoke(id, response) as any, { origin: id })
          );
        }
      },
      (errorData) => {
        if (!canceled) {
          this.removeChild(id);
          const errorEvent = error(id, errorData);
          try {
            // Send "error.platform.id" to this (parent).
            this.send(toSCXMLEvent(errorEvent as any, { origin: id }));
          } catch (error) {
            reportUnhandledExceptionOnInvocation(errorData, error, id);
            if (this.devTools) {
              this.devTools.send(errorEvent, this.state);
            }
            if (this.machine.strict) {
              // it would be better to always stop the state machine if unhandled
              // exception/promise rejection happens but because we don't want to
              // break existing code so enforce it on strict mode only especially so
              // because documentation says that onError is optional
              this.stop();
            }
          }
        }
      }
    );

    const actor: ActorRef<never, T> = {
      id,
      send: () => void 0,
      subscribe: (next, handleError?, complete?) => {
        const observer = toObserver(next, handleError, complete);

        let unsubscribed = false;
        promise.then(
          (response) => {
            if (unsubscribed) {
              return;
            }
            observer.next(response);
            if (unsubscribed) {
              return;
            }
            observer.complete();
          },
          (err) => {
            if (unsubscribed) {
              return;
            }
            observer.error(err);
          }
        );

        return {
          unsubscribe: () => (unsubscribed = true)
        };
      },
      stop: () => {
        canceled = true;
      },
      toJSON() {
        return { id };
      },
      getSnapshot: () => resolvedData,
      [symbolObservable]: function () {
        return this;
      }
    };

    this.children.set(id, actor);

    return actor;
  }
  private spawnCallback(callback: InvokeCallback, id: string): ActorRef<any> {
    let canceled = false;
    const receivers = new Set<(e: EventObject) => void>();
    const listeners = new Set<(e: EventObject) => void>();
    let emitted: TEvent | undefined;

    const receive = (e: TEvent) => {
      emitted = e;
      listeners.forEach((listener) => listener(e));
      if (canceled) {
        return;
      }
      this.send(toSCXMLEvent(e, { origin: id }));
    };

    let callbackStop;

    try {
      callbackStop = callback(receive, (newListener) => {
        receivers.add(newListener);
      });
    } catch (err) {
      this.send(error(id, err) as any);
    }

    if (isPromiseLike(callbackStop)) {
      // it turned out to be an async function, can't reliably check this before calling `callback`
      // because transpiled async functions are not recognizable
      return this.spawnPromise(callbackStop as Promise<any>, id);
    }

    const actor = {
      id,
      send: (event) => receivers.forEach((receiver) => receiver(event)),
      subscribe: (next) => {
        const observer = toObserver(next);
        listeners.add(observer.next);

        return {
          unsubscribe: () => {
            listeners.delete(observer.next);
          }
        };
      },
      stop: () => {
        canceled = true;
        if (isFunction(callbackStop)) {
          callbackStop();
        }
      },
      toJSON() {
        return { id };
      },
      getSnapshot: () => emitted,
      [symbolObservable]: function () {
        return this;
      }
    };

    this.children.set(id, actor);

    return actor;
  }
  private spawnObservable<T extends TEvent>(
    source: Subscribable<T>,
    id: string
  ): ActorRef<any, T> {
    let emitted: T | undefined;

    const subscription = source.subscribe(
      (value) => {
        emitted = value;
        this.send(toSCXMLEvent(value, { origin: id }));
      },
      (err) => {
        this.removeChild(id);
        this.send(toSCXMLEvent(error(id, err) as any, { origin: id }));
      },
      () => {
        this.removeChild(id);
        this.send(toSCXMLEvent(doneInvoke(id) as any, { origin: id }));
      }
    );

    const actor: ActorRef<any, T> = {
      id,
      send: () => void 0,
      subscribe: (next, handleError?, complete?) => {
        return source.subscribe(next, handleError, complete);
      },
      stop: () => subscription.unsubscribe(),
      getSnapshot: () => emitted,
      toJSON() {
        return { id };
      },
      [symbolObservable]: function () {
        return this;
      }
    };

    this.children.set(id, actor);

    return actor;
  }
  private spawnActor<T extends ActorRef<any>>(actor: T, name: string): T {
    this.children.set(name, actor);

    return actor;
  }
  private spawnActivity(activity: ActivityDefinition<TContext, TEvent>): void {
    const implementation =
      this.machine.options && this.machine.options.activities
        ? this.machine.options.activities[activity.type]
        : undefined;

    if (!implementation) {
      if (!IS_PRODUCTION) {
        warn(false, `No implementation found for activity '${activity.type}'`);
      }
      // tslint:disable-next-line:no-console
      return;
    }

    // Start implementation
    const dispose = implementation(this.state.context, activity);
    this.spawnEffect(activity.id, dispose);
  }
  private spawnEffect(
    id: string,
    dispose?: DisposeActivityFunction | void
  ): void {
    this.children.set(id, {
      id,
      send: () => void 0,
      subscribe: () => {
        return { unsubscribe: () => void 0 };
      },
      stop: dispose || undefined,
      getSnapshot: () => undefined,
      toJSON() {
        return { id };
      },
      [symbolObservable]: function () {
        return this;
      }
    });
  }

  private attachDev(): void {
    const global = getGlobal();
    if (this.options.devTools && global) {
      if ((global as any).__REDUX_DEVTOOLS_EXTENSION__) {
        const devToolsOptions =
          typeof this.options.devTools === 'object'
            ? this.options.devTools
            : undefined;
        this.devTools = (global as any).__REDUX_DEVTOOLS_EXTENSION__.connect(
          {
            name: this.id,
            autoPause: true,
            stateSanitizer: (state: AnyState): object => {
              return {
                value: state.value,
                context: state.context,
                actions: state.actions
              };
            },
            ...devToolsOptions,
            features: {
              jump: false,
              skip: false,
              ...(devToolsOptions
                ? (devToolsOptions as any).features
                : undefined)
            }
          },
          this.machine
        );
        this.devTools.init(this.state);
      }

      // add XState-specific dev tooling hook
      registerService(this);
    }
  }
  public toJSON() {
    return {
      id: this.id
    };
  }

  public [symbolObservable](): InteropSubscribable<
    State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta>
  > {
    return this;
  }

  public getSnapshot() {
    if (this.status === InterpreterStatus.NotStarted) {
      return this.initialState;
    }
    return this._state!;
  }
}

const resolveSpawnOptions = (nameOrOptions?: string | SpawnOptions) => {
  if (isString(nameOrOptions)) {
    return { ...DEFAULT_SPAWN_OPTIONS, name: nameOrOptions };
  }

  return {
    ...DEFAULT_SPAWN_OPTIONS,
    name: uniqueId(),
    ...nameOrOptions
  };
};

export function spawn<T extends Behavior<any, any>>(
  entity: T,
  nameOrOptions?: string | SpawnOptions
): ActorRefFrom<T>;
export function spawn<TC, TE extends EventObject>(
  entity: StateMachine<TC, any, TE, any, any, any, any>,
  nameOrOptions?: string | SpawnOptions
): ActorRefFrom<StateMachine<TC, any, TE, any, any, any, any>>;
export function spawn(
  entity: Spawnable,
  nameOrOptions?: string | SpawnOptions
): ActorRef<any>;
export function spawn(
  entity: Spawnable,
  nameOrOptions?: string | SpawnOptions
): ActorRef<any> {
  const resolvedOptions = resolveSpawnOptions(nameOrOptions);

  return serviceScope.consume((service) => {
    if (!IS_PRODUCTION) {
      const isLazyEntity = isMachine(entity) || isFunction(entity);
      warn(
        !!service || isLazyEntity,
        `Attempted to spawn an Actor (ID: "${
          isMachine(entity) ? entity.id : 'undefined'
        }") outside of a service. This will have no effect.`
      );
    }

    if (service) {
      return service.spawn(entity, resolvedOptions.name, resolvedOptions);
    } else {
      return createDeferredActor(entity, resolvedOptions.name);
    }
  });
}

/**
 * Creates a new Interpreter instance for the given machine with the provided options, if any.
 *
 * @param machine The machine to interpret
 * @param options Interpreter options
 */
export function interpret<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TResolvedTypesMeta = TypegenDisabled
>(
  machine: AreAllImplementationsAssumedToBeProvided<TResolvedTypesMeta> extends true
    ? StateMachine<
        TContext,
        TStateSchema,
        TEvent,
        TTypestate,
        any,
        any,
        TResolvedTypesMeta
      >
    : MissingImplementationsError<TResolvedTypesMeta>,
  options?: InterpreterOptions
) {
  const interpreter = new Interpreter<
    TContext,
    TStateSchema,
    TEvent,
    TTypestate,
    TResolvedTypesMeta
  >(machine as any, options);

  return interpreter;
}
