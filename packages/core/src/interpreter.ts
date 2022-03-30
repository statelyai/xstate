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
  DisposeActivityFunction,
  StateValue,
  InterpreterOptions,
  ActivityDefinition,
  SingleOrArray,
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
  StopActionObject,
  Subscription,
  AnyState,
  StateConfig,
  InteropSubscribable
} from './types';
import { State, bindActionToState, isStateConfig } from './State';
import * as actionTypes from './actionTypes';
import { doneInvoke, getActionFunction, initEvent } from './actions';
import { IS_PRODUCTION } from './environment';
import {
  mapContext,
  warn,
  isArray,
  isFunction,
  isString,
  uniqueId,
  isMachine,
  toEventObject,
  toSCXMLEvent,
  toInvokeSource,
  isActor,
  symbolObservable,
  wrapWithOrigin,
  isBehavior
} from './utils';
import { Scheduler } from './scheduler';
import { Actor, createDeferredActor } from './Actor';
import { isInFinalState } from './stateUtils';
import { registry } from './registry';
import { getGlobal, registerService } from './devTools';
import { CapturedState, captureSpawn } from './capturedState';
import {
  AreAllImplementationsAssumedToBeProvided,
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
    > {
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

  private scheduler: Scheduler = new Scheduler();
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

  // Dev Tools
  private devTools?: any;

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
    // TODO: check if it's safe to cache this, especially when it comes to those spawns, they probably can't really be reused
    if (this._initialState) {
      return this._initialState;
    }

    try {
      CapturedState.current = {
        actorRef: this,
        spawns: []
      };
      const initialState = this.machine.initialState;
      this._initialState = initialState;
      return this._initialState;
    } finally {
      CapturedState.current = {
        actorRef: undefined,
        spawns: []
      };
    }
  }
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
    if (this.options.execute) {
      this.execute(this.state);
    }

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

    const isDone = isInFinalState(
      state.configuration || [],
      this.machine as any
    );

    if (this.state.configuration && isDone) {
      // get final child state node
      const finalChildStateNode = state.configuration.find(
        (sn) => sn.type === 'final' && sn.parent === (this.machine as any)
      );

      const doneData =
        finalChildStateNode && finalChildStateNode.doneData
          ? mapContext(finalChildStateNode.doneData, state.context, _event)
          : undefined;

      for (const listener of this.doneListeners) {
        listener(doneInvoke(this.id, doneData));
      }
      this.stop();
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
    observer: Observer<
      State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta>
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
      | Observer<State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta>>,
    _?: (error: any) => void, // TODO: error listener
    completeListener?: () => void
  ): Subscription {
    if (!nextListenerOrObserver) {
      return { unsubscribe: () => void 0 };
    }

    let listener: (
      state: State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta>
    ) => void;
    let resolvedCompleteListener = completeListener;

    if (typeof nextListenerOrObserver === 'function') {
      listener = nextListenerOrObserver;
    } else {
      listener = nextListenerOrObserver.next.bind(nextListenerOrObserver);
      resolvedCompleteListener = nextListenerOrObserver.complete.bind(
        nextListenerOrObserver
      );
    }

    this.listeners.add(listener);

    // Send current state to listener
    if (this.status === InterpreterStatus.Running) {
      listener(this.state);
    }

    if (resolvedCompleteListener) {
      this.onDone(resolvedCompleteListener);
    }

    return {
      unsubscribe: () => {
        listener && this.listeners.delete(listener);
        resolvedCompleteListener &&
          this.doneListeners.delete(resolvedCompleteListener);
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
    this.doneListeners.add(listener);
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
        : isStateConfig<TContext, TEvent>(initialState)
        ? this.machine.resolveState(initialState)
        : this.machine.resolveState(
            State.from(initialState, this.machine.context)
          );

    if (this.options.devTools) {
      this.attachDev();
    }
    this.scheduler.initialize(() => {
      this.update(resolvedState, initEvent as SCXML.Event<TEvent>);
    });
    return this;
  }
  /**
   * Stops the interpreter and unsubscribe all listeners.
   *
   * This will also notify the `onStop` listeners.
   */
  public stop(): this {
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

    [...this.state.configuration]
      .sort((a, b) => b.order - a.order)
      .forEach((stateNode) => {
        for (const action of stateNode.definition.exit) {
          this.exec(action, this.state);
        }
      });

    // Stop all children
    this.children.forEach((child) => {
      if (isFunction(child.stop)) {
        child.stop();
      }
    });

    // Cancel all delayed events
    for (const key of Object.keys(this.delayedEventsMap)) {
      this.clock.clearTimeout(this.delayedEventsMap[key]);
    }

    this.scheduler.clear();
    this.initialized = false;
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

      const nextState = this.nextState(_event);

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

    this.scheduler.schedule(() => {
      let nextState = this.state;
      let batchChanged = false;
      const batchedActions: Array<ActionObject<TContext, TEvent>> = [];
      for (const event of events) {
        const _event = toSCXMLEvent(event);

        this.forward(_event);

        try {
          CapturedState.current = {
            actorRef: this,
            spawns: []
          };
          nextState = this.machine.transition(nextState, _event);
        } finally {
          CapturedState.current = {
            actorRef: undefined,
            spawns: []
          };
        }

        batchedActions.push(
          ...(nextState.actions.map((a) =>
            bindActionToState(a, nextState)
          ) as Array<ActionObject<TContext, TEvent>>)
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
    to: string | number | ActorRef<any>
  ) => {
    const isParent =
      this.parent && (to === SpecialTargets.Parent || this.parent.id === to);
    const target = isParent
      ? this.parent
      : isString(to)
      ? this.children.get(to as string) || registry.get(to as string)
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
      // Send SCXML events to machines
      (target as AnyInterpreter).send(wrapWithOrigin(this, event));
    } else {
      // Send normal events to other targets
      target.send(event.data);
    }
  };
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
    const _event = toSCXMLEvent(event);

    if (
      _event.name.indexOf(actionTypes.errorPlatform) === 0 &&
      !this.state.nextEvents.some(
        (nextEvent) => nextEvent.indexOf(actionTypes.errorPlatform) === 0
      )
    ) {
      throw (_event.data as any).data;
    }

    try {
      CapturedState.current = {
        actorRef: this,
        spawns: []
      };
      return this.machine.transition(this.state, _event);
    } finally {
      CapturedState.current = {
        actorRef: undefined,
        spawns: []
      };
    }
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
  private defer(sendAction: SendActionObject<TContext, TEvent>): void {
    this.delayedEventsMap[sendAction.id] = this.clock.setTimeout(() => {
      if (sendAction.to) {
        this.sendTo(sendAction._event, sendAction.to);
      } else {
        this.send(
          (sendAction as SendActionObject<TContext, TEvent, TEvent>)._event
        );
      }
    }, sendAction.delay as number);
  }
  private cancel(sendId: string | number): void {
    this.clock.clearTimeout(this.delayedEventsMap[sendId]);
    delete this.delayedEventsMap[sendId];
  }
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
  ): void {
    const { context, _event } = state;
    const actionOrExec =
      action.exec || getActionFunction(action.type, actionFunctionMap);
    const exec = isFunction(actionOrExec)
      ? actionOrExec
      : actionOrExec
      ? actionOrExec.exec
      : action.exec;

    if (exec) {
      try {
        return (exec as any)(context, _event.data, {
          action,
          state: this.state,
          _event
        });
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
      case actionTypes.send:
        const sendAction = action as SendActionObject<TContext, TEvent>;

        if (typeof sendAction.delay === 'number') {
          this.defer(sendAction);
          return;
        } else {
          if (sendAction.to) {
            this.sendTo(sendAction._event, sendAction.to);
          } else {
            this.send(
              (sendAction as SendActionObject<TContext, TEvent, TEvent>)._event
            );
          }
        }
        break;

      case actionTypes.cancel:
        this.cancel((action as CancelAction).sendId);

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
        if (!this.state.activities[activity.id || activity.type]) {
          break;
        }

        // Invoked services
        if (activity.type === ActionTypes.Invoke) {
          const invokeSource = toInvokeSource(activity.src);
          const serviceCreator = this.machine.options.services
            ? this.machine.options.services[invokeSource.type]
            : undefined;

          const { data } = activity;

          if (!IS_PRODUCTION) {
            warn(
              !('forward' in activity),
              // tslint:disable-next-line:max-line-length
              `\`forward\` property is deprecated (found in invocation of '${activity.src}' in in machine '${this.machine.id}'). ` +
                `Please use \`autoForward\` instead.`
            );
          }

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

          if (isMachine(source)) {
            source = resolvedData ? source.withContext(resolvedData) : source;
          }

          const isLazyEntity =
            isMachine(source) || isFunction(source) || isBehavior(source);
          activity.deferred.start({
            parent: this,
            entity: isLazyEntity ? source : () => source
          });
        } else if (activity.type === ActionTypes.Spawn) {
          activity.deferred.start({ parent: this, entity: activity.entity });
        } else {
          this.spawnActivity(activity);
        }

        break;
      }
      case actionTypes.stop: {
        this.stopChild((action as StopActionObject).activity.id);
        break;
      }

      case actionTypes.log:
        const { label, value } = action;

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

    return undefined;
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
    if (!IS_PRODUCTION) {
      console.warn(
        "`interpreter.spawn` isn't supposed to be a public API. Please don't use this."
      );
    }
    const { start, actorRef } = createDeferredActor(
      resolveSpawnOptions({ ...options, name })
    );
    start({ parent: this, entity });
    return actorRef;
  }
  public spawnMachine<
    TChildContext,
    TChildStateSchema,
    TChildEvent extends EventObject
  >(
    machine: StateMachine<TChildContext, TChildStateSchema, TChildEvent>,
    options: { id?: string; autoForward?: boolean; sync?: boolean } = {}
  ): ActorRef<TChildEvent, State<TChildContext, TChildEvent>> {
    if (!IS_PRODUCTION) {
      console.warn(
        "`interpreter.spawnMachine` isn't supposed to be a public API. Please don't use this."
      );
    }
    const { start, actorRef } = createDeferredActor(
      resolveSpawnOptions(options)
    );
    start({ parent: this, entity: machine });
    return actorRef;
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
  const isLazyEntity =
    isMachine(entity) ||
    isFunction(entity) ||
    isBehavior(entity) ||
    isActor(entity);

  if (!IS_PRODUCTION) {
    const service = CapturedState.current.actorRef;
    warn(
      !!service || isLazyEntity,
      `Attempted to spawn an Actor (ID: "${
        isMachine(entity) ? entity.id : 'undefined'
      }") outside of a service. This will have no effect.`
    );
  }

  const resolvedOptions = resolveSpawnOptions(nameOrOptions);

  if (isMachine(entity)) {
    const parent = CapturedState.current.actorRef as any;
    const childService = new Interpreter(entity, {
      ...parent?.options, // inherit options from this interpreter
      parent,
      id: resolvedOptions.name || entity.id
    });
    const deferred = createDeferredActor(resolvedOptions, childService);
    captureSpawn(deferred, childService);
    return childService;
  }

  const deferred = createDeferredActor(
    resolvedOptions,
    isActor(entity) ? entity : undefined
  );

  captureSpawn(deferred, isLazyEntity ? entity : () => entity);

  return deferred.actorRef;
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
    : 'Some implementations missing',
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
