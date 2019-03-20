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
  OmniEventObject,
  OmniEvent,
  SendActionObject,
  ServiceConfig,
  InvokeCallback,
  Sender,
  DisposeActivityFunction,
  ErrorExecutionEvent,
  StateValue,
  InterpreterOptions
} from './types';
import { State } from './State';
import * as actionTypes from './actionTypes';
import { toEventObject, doneInvoke, error } from './actions';
import { IS_PRODUCTION } from './StateNode';
import { mapContext } from './utils';

export type StateListener<TContext, TEvent extends EventObject> = (
  state: State<TContext, TEvent>,
  event: OmniEventObject<TEvent>
) => void;

export type ContextListener<TContext = DefaultContext> = (
  context: TContext,
  prevContext: TContext | undefined
) => void;

export type EventListener = (event: EventObject) => void;

export type Listener = () => void;

export interface Clock {
  setTimeout(fn: (...args: any[]) => void, timeout: number): any;
  clearTimeout(id: any): void;
}

export interface SimulatedClock extends Clock {
  start(speed: number): void;
  increment(ms: number): void;
  set(ms: number): void;
}

interface SimulatedTimeout {
  start: number;
  timeout: number;
  fn: (...args: any[]) => void;
}
export class SimulatedClock implements SimulatedClock {
  private timeouts: Map<number, SimulatedTimeout> = new Map();
  private _now: number = 0;
  private _id: number = 0;
  public now() {
    return this._now;
  }
  private getId() {
    return this._id++;
  }
  public setTimeout(fn: (...args: any[]) => void, timeout: number) {
    const id = this.getId();
    this.timeouts.set(id, {
      start: this.now(),
      timeout,
      fn
    });
    return id;
  }
  public clearTimeout(id: number) {
    this.timeouts.delete(id);
  }
  public set(time: number) {
    if (this._now > time) {
      throw new Error('Unable to travel back in time');
    }

    this._now = time;
    this.flushTimeouts();
  }
  private flushTimeouts() {
    this.timeouts.forEach((timeout, id) => {
      if (this.now() - timeout.start >= timeout.timeout) {
        timeout.fn.call(null);
        this.timeouts.delete(id);
      }
    });
  }
  public increment(ms: number): void {
    this._now += ms;
    this.flushTimeouts();
  }
}

export interface Actor {
  send: Sender<any>;
  stop: (() => void) | void;
}

export class Interpreter<
  // tslint:disable-next-line:max-classes-per-file
  TContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = EventObject
> {
  /**
   * The default interpreter options:
   *
   * - `clock` uses the global `setTimeout` and `clearTimeout` functions
   * - `logger` uses the global `console.log()` method
   */
  public static defaultOptions: InterpreterOptions = (global => ({
    execute: true,
    deferEvents: true,
    clock: {
      setTimeout: (fn, ms) => {
        return global.setTimeout.call(null, fn, ms);
      },
      clearTimeout: id => {
        return global.clearTimeout.call(null, id);
      }
    },
    logger: global.console.log.bind(console),
    devTools: false
  }))(typeof window === 'undefined' ? global : window);
  /**
   * The current state of the interpreted machine.
   */
  public state: State<TContext, TEvent>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;
  public options: InterpreterOptions;

  private delayedEventsMap: Record<string, number> = {};
  private listeners: Set<StateListener<TContext, TEvent>> = new Set();
  private contextListeners: Set<ContextListener<TContext>> = new Set();
  private stopListeners: Set<Listener> = new Set();
  private doneListeners: Set<EventListener> = new Set();
  private eventListeners: Set<EventListener> = new Set();
  private sendListeners: Set<EventListener> = new Set();
  private logger: (...args: any[]) => void;
  private initialized = false;

  // Actor
  public parent?: Interpreter<any>;
  public id: string;
  private children: Map<string, Actor> = new Map();
  private forwardTo: Set<string> = new Set();

  // Scheduler
  private eventQueue: Array<OmniEventObject<TEvent>> = [];
  private isFlushing: boolean;

  // Dev Tools
  private devTools?: any;

  /**
   * Creates a new Interpreter instance (i.e., service) for the given machine with the provided options, if any.
   *
   * @param machine The machine to be interpreted
   * @param options Interpreter options
   */
  constructor(
    public machine: StateMachine<TContext, TStateSchema, TEvent>,
    options: Partial<InterpreterOptions> = Interpreter.defaultOptions
  ) {
    const resolvedOptions: InterpreterOptions = {
      ...Interpreter.defaultOptions,
      ...options
    };

    const { clock, logger, parent, id } = resolvedOptions;

    const resolvedId = id !== undefined ? id : machine.id;

    Object.assign(this, {
      clock,
      logger,
      parent,
      id: resolvedId
    });

    this.options = resolvedOptions;
  }
  public static interpret = interpret;
  /**
   * The initial state of the statechart.
   */
  public get initialState(): State<TContext, TEvent> {
    return this.machine.initialState;
  }
  /**
   * Executes the actions of the given state, with that state's `context` and `event`.
   *
   * @param state The state whose actions will be executed
   */
  public execute(state: State<TContext, TEvent>): void {
    state.actions.forEach(action => {
      this.exec(action, state.context, state.event);
    });
  }
  private update(
    state: State<TContext, TEvent>,
    event: Event<TEvent> | OmniEventObject<TEvent>
  ): void {
    // Update state
    this.state = state;

    // Execute actions
    if (this.options.execute) {
      this.execute(this.state);
    }

    // Dev tools
    if (this.devTools) {
      this.devTools.send(event, state);
    }

    // Execute listeners
    if (state.event) {
      this.eventListeners.forEach(listener => listener(state.event));
    }

    this.listeners.forEach(listener => listener(state, state.event));
    this.contextListeners.forEach(ctxListener =>
      ctxListener(
        this.state.context,
        this.state.history ? this.state.history.context : undefined
      )
    );

    if (this.state.tree && this.state.tree.done) {
      // get donedata
      const doneData = this.state.tree.getDoneData(
        this.state.context,
        toEventObject<OmniEventObject<TEvent>>(event)
      );
      this.doneListeners.forEach(listener =>
        listener(doneInvoke(this.id, doneData))
      );
      this.stop();
    }
    // this.flushEventQueue();
  }
  /*
   * Adds a listener that is notified whenever a state transition happens. The listener is called with
   * the next state and the event object that caused the state transition.
   *
   * @param listener The state listener
   */
  public onTransition(
    listener: StateListener<TContext, TEvent>
  ): Interpreter<TContext, TStateSchema, TEvent> {
    this.listeners.add(listener);
    return this;
  }
  /**
   * Adds an event listener that is notified whenever an event is sent to the running interpreter.
   * @param listener The event listener
   */
  public onEvent(
    listener: EventListener
  ): Interpreter<TContext, TStateSchema, TEvent> {
    this.eventListeners.add(listener);
    return this;
  }
  /**
   * Adds an event listener that is notified whenever a `send` event occurs.
   * @param listener The event listener
   */
  public onSend(
    listener: EventListener
  ): Interpreter<TContext, TStateSchema, TEvent> {
    this.sendListeners.add(listener);
    return this;
  }
  /**
   * Adds a context listener that is notified whenever the state context changes.
   * @param listener The context listener
   */
  public onChange(
    listener: ContextListener<TContext>
  ): Interpreter<TContext, TStateSchema, TEvent> {
    this.contextListeners.add(listener);
    return this;
  }
  /**
   * Adds a listener that is notified when the machine is stopped.
   * @param listener The listener
   */
  public onStop(
    listener: Listener
  ): Interpreter<TContext, TStateSchema, TEvent> {
    this.stopListeners.add(listener);
    return this;
  }
  /**
   * Adds a state listener that is notified when the statechart has reached its final state.
   * @param listener The state listener
   */
  public onDone(
    listener: EventListener
  ): Interpreter<TContext, TStateSchema, TEvent> {
    this.doneListeners.add(listener);
    return this;
  }
  /**
   * Removes a listener.
   * @param listener The listener to remove
   */
  public off(
    listener: (...args: any[]) => void
  ): Interpreter<TContext, TStateSchema, TEvent> {
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
    initialState?: State<TContext, TEvent> | StateValue
  ): Interpreter<TContext, TStateSchema, TEvent> {
    const resolvedState =
      initialState === undefined
        ? this.machine.initialState
        : initialState instanceof State
        ? this.machine.resolveState(initialState)
        : this.machine.resolveState(State.from(initialState));
    this.initialized = true;
    if (this.options.devTools) {
      this.attachDev();
    }
    this.update(resolvedState, {
      type: actionTypes.init
    });
    this.flush();
    return this;
  }
  /**
   * Stops the interpreter and unsubscribe all listeners.
   *
   * This will also notify the `onStop` listeners.
   */
  public stop(): Interpreter<TContext, TStateSchema, TEvent> {
    this.listeners.forEach(listener => this.listeners.delete(listener));
    this.stopListeners.forEach(listener => {
      // call listener, then remove
      listener();
      this.stopListeners.delete(listener);
    });
    this.contextListeners.forEach(ctxListener =>
      this.contextListeners.delete(ctxListener)
    );
    this.doneListeners.forEach(doneListener =>
      this.doneListeners.delete(doneListener)
    );

    // Stop all children
    this.children.forEach(child => {
      if (typeof child.stop === 'function') {
        child.stop();
      }
    });

    // Cancel all delayed events
    Object.keys(this.delayedEventsMap).forEach(key => {
      this.clock.clearTimeout(this.delayedEventsMap[key]);
    });

    this.initialized = false;

    return this;
  }
  /**
   * Sends an event to the running interpreter to trigger a transition,
   * and returns the immediate next state.
   *
   * @param event The event to send
   */
  public send = (event: OmniEvent<TEvent>): State<TContext, TEvent> => {
    const eventObject = toEventObject<OmniEventObject<TEvent>>(event);
    this.eventQueue.push(eventObject);

    if (!this.initialized) {
      if (this.options.deferEvents) {
        console.warn(
          `Event "${eventObject.type}" was sent to uninitialized service "${
            this.machine.id
          }" and is deferred. Make sure .start() is called for this service.\nEvent: ${JSON.stringify(
            event
          )}`
        );
      } else {
        throw new Error(
          `Event "${eventObject.type}" was sent to uninitialized service "${
            this.machine.id
            // tslint:disable-next-line:max-line-length
          }". Make sure .start() is called for this service, or set { deferEvents: true } in the service options.\nEvent: ${JSON.stringify(
            eventObject
          )}`
        );
      }
    } else {
      this.flush();
    }

    return this.state; // TODO: deprecate (should return void)
    // tslint:disable-next-line:semicolon
  };

  /**
   * Flushes all pending events in the event queue.
   */
  private flush() {
    if (!this.isFlushing) {
      this.isFlushing = true;
      while (this.eventQueue.length) {
        const nextEvent = this.eventQueue.shift()!;
        const nextState = this.nextState(nextEvent);

        this.update(nextState, nextEvent);

        // Forward copy of event to child interpreters
        this.forward(nextEvent);
      }
      this.isFlushing = false;
    }
  }

  /**
   * Returns a send function bound to this interpreter instance.
   *
   * @param event The event to be sent by the sender.
   */
  public sender = (event: Event<TEvent>): (() => State<TContext, TEvent>) => {
    function sender() {
      return this.send(event);
    }

    return sender.bind(this);
  }

  public sendTo = (event: OmniEventObject<TEvent>, to: string) => {
    const isParent = to === SpecialTargets.Parent;
    const target = isParent ? this.parent : this.children.get(to);

    if (!target) {
      if (!isParent) {
        throw new Error(
          `Unable to send event to child '${to}' from service '${this.id}'.`
        );
      }

      // tslint:disable-next-line:no-console
      console.warn(
        `Service '${this.id}' has no parent: unable to send event ${event.type}`
      );
      return;
    }

    // Process on next tick to avoid conflict with in-process event on parent
    setTimeout(() => {
      target.send(event);
    });
  }
  /**
   * Returns the next state given the interpreter's current state and the event.
   *
   * This is a pure method that does _not_ update the interpreter's state.
   *
   * @param event The event to determine the next state
   */
  public nextState(event: OmniEvent<TEvent>): State<TContext, TEvent> {
    const eventObject = toEventObject<OmniEventObject<TEvent>>(event);

    if (
      eventObject.type === actionTypes.errorExecution &&
      this.state.nextEvents.indexOf(actionTypes.errorExecution) === -1
    ) {
      throw (eventObject as ErrorExecutionEvent).data;
    }

    const nextState = this.machine.transition(
      this.state,
      eventObject,
      this.state.context
    );

    return nextState;
  }
  private forward(event: OmniEventObject<TEvent>): void {
    this.forwardTo.forEach(id => {
      const child = this.children.get(id);

      if (!child) {
        throw new Error(
          `Unable to forward event '${event}' from interpreter '${
            this.id
          }' to nonexistant child '${id}'.`
        );
      }

      child.send(event);
    });
  }
  private defer(sendAction: SendActionObject<TContext, TEvent>): void {
    let { delay } = sendAction;

    if (typeof delay === 'string') {
      if (
        !this.machine.options.delays ||
        this.machine.options.delays[delay] === undefined
      ) {
        console.warn(
          `No delay reference for delay expression '${delay}' was found on machine '${
            this.machine.id
          }' on service '${this.id}'.`
        );

        // Do not send anything
        return;
      } else {
        const delayExpr = this.machine.options.delays[delay];
        delay =
          typeof delayExpr === 'number'
            ? delayExpr
            : delayExpr(this.state.context, this.state.event);
      }
    }

    this.delayedEventsMap[sendAction.id] = this.clock.setTimeout(() => {
      if (sendAction.to) {
        this.sendTo(sendAction.event, sendAction.to);
      } else {
        this.send(sendAction.event);
      }
    }, (delay as number) || 0);
  }
  private cancel(sendId: string | number): void {
    this.clock.clearTimeout(this.delayedEventsMap[sendId]);
    delete this.delayedEventsMap[sendId];
  }
  private exec(
    action: ActionObject<TContext, OmniEventObject<TEvent>>,
    context: TContext,
    event: OmniEventObject<TEvent>
  ): void {
    if (action.exec) {
      return action.exec(context, event, { action, state: this.state });
    }

    switch (action.type) {
      case actionTypes.send:
        const sendAction = action as SendActionObject<TContext, TEvent>;

        if (sendAction.delay) {
          this.defer(sendAction);
          return;
        } else {
          if (sendAction.to) {
            this.sendTo(sendAction.event, sendAction.to);
          } else {
            this.send(sendAction.event);
          }
        }
        break;

      case actionTypes.cancel:
        this.cancel((action as CancelAction).sendId);

        break;
      case actionTypes.start: {
        const activity = (action as ActivityActionObject<TContext, TEvent>)
          .activity as InvokeDefinition<TContext, TEvent>;

        // If the activity will be stopped right after it's started
        // (such as in transient states)
        // don't bother starting the activity.
        if (!this.state.activities[activity.type]) {
          break;
        }

        // Invoked services
        if (activity.type === ActionTypes.Invoke) {
          const serviceCreator: ServiceConfig<TContext> | undefined = this
            .machine.options.services
            ? this.machine.options.services[activity.src]
            : undefined;

          const { id, data } = activity;

          const autoForward = !!activity.forward;

          if (!serviceCreator) {
            // tslint:disable-next-line:no-console
            console.warn(
              `No service found for invocation '${activity.src}' in machine '${
                this.machine.id
              }'.`
            );
            return;
          }

          const source =
            typeof serviceCreator === 'function'
              ? serviceCreator(context, event)
              : serviceCreator;

          if (source instanceof Promise) {
            this.spawnPromise(id, source);
          } else if (typeof source === 'function') {
            this.spawnCallback(id, source);
          } else if (typeof source !== 'string') {
            // TODO: try/catch here
            this.spawn(
              data
                ? source.withContext(mapContext(data, context, event as TEvent))
                : source,
              {
                id,
                autoForward
              }
            );
          } else {
            // service is string
          }
        } else {
          const implementation =
            this.machine.options && this.machine.options.activities
              ? this.machine.options.activities[activity.type]
              : undefined;

          if (!implementation) {
            // tslint:disable-next-line:no-console
            console.warn(
              `No implementation found for activity '${activity.type}'`
            );
            return;
          }

          // Start implementation
          const dispose = implementation(context, activity);
          this.spawnEffect(activity.id, dispose);
        }

        break;
      }
      case actionTypes.stop: {
        this.stopChild(action.activity.id);

        break;
      }

      case actionTypes.log:
        const expr = action.expr ? action.expr(context, event) : undefined;

        if (action.label) {
          this.logger(action.label, expr);
        } else {
          this.logger(expr);
        }
        break;
      default:
        // tslint:disable-next-line:no-console
        console.warn(
          `No implementation found for action type '${action.type}'`
        );
        break;
    }

    return undefined;
  }
  private stopChild(childId: string): void {
    const child = this.children.get(childId);
    if (child && typeof child.stop === 'function') {
      child.stop();
      this.children.delete(childId);
      this.forwardTo.delete(childId);
    }
  }
  private spawn<
    TChildContext,
    TChildStateSchema,
    TChildEvents extends EventObject
  >(
    machine: StateMachine<TChildContext, TChildStateSchema, TChildEvents>,
    options: { id?: string; autoForward?: boolean } = {}
  ): Interpreter<TChildContext, TChildStateSchema, TChildEvents> {
    const childService = new Interpreter(machine, {
      parent: this,
      id: options.id || machine.id
    });

    childService
      .onDone(doneEvent => {
        this.send(doneEvent as OmniEvent<TEvent>); // todo: fix
      })
      .start();

    this.children.set(childService.id, childService);

    if (options.autoForward) {
      this.forwardTo.add(childService.id);
    }

    return childService;
  }
  private spawnPromise(id: string, promise: Promise<any>): void {
    let canceled = false;

    promise
      .then(response => {
        if (!canceled) {
          this.send(doneInvoke(id, response));
        }
      })
      .catch(errorData => {
        if (!canceled) {
          // Send "error.execution" to this (parent).
          this.send(error(errorData, id));
        }
      });

    this.children.set(id, {
      send: () => void 0,
      stop: () => {
        canceled = true;
      }
    });
  }
  private spawnCallback(id: string, callback: InvokeCallback): void {
    const receive = (e: TEvent) => this.send(e);
    let listener = (e: EventObject) => {
      if (!IS_PRODUCTION) {
        // tslint:disable-next-line:no-console
        console.warn(
          `Event '${
            e.type
          }' sent to callback service '${id}' but was not handled by a listener.`
        );
      }
    };

    let stop;

    try {
      stop = callback(receive, newListener => {
        listener = newListener;
      });

      if (stop instanceof Promise) {
        stop.catch(e => this.send(error(e, id)));
      }
    } catch (e) {
      this.send(error(e, id));
    }

    this.children.set(id, {
      send: listener,
      stop
    });
  }
  private spawnEffect(
    id: string,
    dispose?: DisposeActivityFunction | void
  ): void {
    this.children.set(id, {
      send: () => void 0,
      stop: dispose
    });
  }
  // private flushEventQueue() {
  //   const flushedEvent = this.eventQueue.shift();
  //   if (flushedEvent) {
  //     this.send(flushedEvent);
  //   }
  // }
  private attachDev() {
    if (
      this.options.devTools &&
      typeof window !== 'undefined' &&
      (window as any).__REDUX_DEVTOOLS_EXTENSION__
    ) {
      this.devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect({
        name: this.id,
        features: {
          jump: false,
          skip: false
        }
      });
      this.devTools.init(this.state);
    }
  }
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
  TEvent extends EventObject = EventObject
>(
  machine: StateMachine<TContext, TStateSchema, TEvent>,
  options?: Partial<InterpreterOptions>
) {
  const interpreter = new Interpreter<TContext, TStateSchema, TEvent>(
    machine,
    options
  );

  return interpreter;
}
