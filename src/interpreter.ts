import {
  Machine as XSMachine,
  Event,
  EventObject,
  SendAction,
  CancelAction,
  DefaultContext,
  ActionObject,
  StateSchema,
  ActivityActionObject,
  SpecialTargets,
  ActionTypes,
  InvokeDefinition
} from './types';
import { State } from './State';
import * as actionTypes from './actionTypes';
import { toEventObject, doneInvoke } from './actions';
import { Machine } from './Machine';
import { StateNode } from './StateNode';

// Check if in Node or browser environment to use proper "global"
const globalOrWindow = window !== undefined ? window : global;

export type StateListener = <TContext = DefaultContext>(
  state: State<TContext>
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

interface InterpreterOptions {
  clock: Clock;
  logger: (...args: any[]) => void;
  parent?: Interpreter<any, any, any>;
  id?: string;
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
  public static defaultOptions: InterpreterOptions = {
    clock: {
      setTimeout: (fn, ms) => {
        return globalOrWindow.setTimeout.call(null, fn, ms);
      },
      clearTimeout: id => {
        return globalOrWindow.clearTimeout.call(null, id);
      }
    },
    logger: globalOrWindow.console.log.bind(console)
  };
  /**
   * The current state of the interpreted machine.
   */
  public state: State<TContext, TEvent>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;

  private eventQueue: TEvent[] = [];
  private delayedEventsMap: Record<string, number> = {};
  private activitiesMap: Record<string, any> = {};
  private listeners: Set<StateListener> = new Set();
  private contextListeners: Set<ContextListener<TContext>> = new Set();
  private stopListeners: Set<Listener> = new Set();
  private doneListeners: Set<StateListener> = new Set();
  private eventListeners: Set<EventListener> = new Set();
  private sendListeners: Set<EventListener> = new Set();
  private logger: (...args: any[]) => void;
  private initialized = false;

  // Actor
  public parent?: Interpreter<any>;
  private children: Set<Interpreter<any>> = new Set();

  /**
   * Creates a new Interpreter instance for the given machine with the provided options, if any.
   *
   * @param machine The machine to be interpreted
   * @param options Interpreter options
   */
  constructor(
    public machine: XSMachine<TContext, TStateSchema, TEvent>,
    options: Partial<InterpreterOptions> = Interpreter.defaultOptions
  ) {
    const resolvedOptions: InterpreterOptions = {
      ...Interpreter.defaultOptions,
      ...options
    };

    this.clock = resolvedOptions.clock;
    this.logger = resolvedOptions.logger;
    this.parent = resolvedOptions.parent;
  }
  public static interpret = interpret;
  /**
   * The initial state of the statechart.
   */
  public get initialState(): State<TContext, TEvent> {
    return this.machine.initialState;
  }
  private update(state: State<TContext, TEvent>, event?: Event<TEvent>): void {
    this.state = state;
    const { context } = this.state;
    const eventObject = event ? toEventObject(event) : undefined;

    this.state.actions.forEach(action => {
      this.exec(action, context, eventObject);
    }, context);

    if (eventObject) {
      this.eventListeners.forEach(listener => listener(eventObject));
    }

    this.listeners.forEach(listener => listener(state));
    this.contextListeners.forEach(ctxListener =>
      ctxListener(
        this.state.context,
        this.state.history ? this.state.history.context : undefined
      )
    );

    if (this.state.tree && this.state.tree.done) {
      this.doneListeners.forEach(listener => listener(state));
      this.stop();
    }

    this.flushEventQueue();
  }
  /*
   * Adds a listener that is notified whenever a state transition happens.
   * @param listener The state listener
   */
  public onTransition(listener: StateListener): Interpreter<TContext> {
    this.listeners.add(listener);
    return this;
  }
  /**
   * Adds an event listener that is notified whenever an event is sent to the running interpreter.
   * @param listener The event listener
   */
  public onEvent(listener: EventListener): Interpreter<TContext> {
    this.eventListeners.add(listener);
    return this;
  }
  /**
   * Adds an event listener that is notified whenever a `send` event occurs.
   * @param listener The event listener
   */
  public onSend(listener: EventListener): Interpreter<TContext> {
    this.sendListeners.add(listener);
    return this;
  }
  /**
   * Adds a context listener that is notified whenever the state context changes.
   * @param listener The context listener
   */
  public onChange(listener: ContextListener<TContext>): Interpreter<TContext> {
    this.contextListeners.add(listener);
    return this;
  }
  /**
   * Adds a listener that is notified when the machine is stopped.
   * @param listener The listener
   */
  public onStop(listener: Listener): Interpreter<TContext> {
    this.stopListeners.add(listener);
    return this;
  }
  /**
   * Adds a state listener that is notified when the statechart has reached its final state.
   * @param listener The state listener
   */
  public onDone(listener: StateListener): Interpreter<TContext> {
    this.doneListeners.add(listener);
    return this;
  }
  /**
   * Removes a listener.
   * @param listener The listener to remove
   */
  public off(listener: StateListener): Interpreter<TContext> {
    this.listeners.delete(listener);
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
    initialState: State<TContext, TEvent> = this.machine.initialState as State<
      TContext,
      TEvent
    >
  ): Interpreter<TContext> {
    this.initialized = true;
    this.update(initialState);
    return this;
  }
  /**
   * Stops the interpreter and unsubscribe all listeners.
   *
   * This will also notify the `onStop` listeners.
   */
  public stop(): Interpreter<TContext> {
    this.listeners.forEach(listener => this.off(listener));
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

    return this;
  }
  /**
   * Sends an event to the running interpreter to trigger a transition,
   * and returns the immediate next state.
   *
   * @param event The event to send
   */
  public send = (event: Event<TEvent>): State<TContext, TEvent> => {
    const eventObject = toEventObject(event);
    const nextState = this.nextState(eventObject);

    this.update(nextState, event);

    // Forward copy of event to child interpreters
    this.forward(eventObject);

    return nextState;
    // tslint:disable-next-line:semicolon
  };
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
  /**
   * Returns the next state given the interpreter's current state and the event.
   *
   * This is a pure method that does _not_ update the interpreter's state.
   *
   * @param event The event to determine the next state
   */
  public nextState(event: Event<TEvent>): State<TContext, TEvent> {
    const eventObject = toEventObject(event);

    if (!this.initialized) {
      throw new Error(
        `Unable to send event "${
          eventObject.type
        }" to an uninitialized interpreter (ID: ${
          this.machine.id
        }). Event: ${JSON.stringify(event)}`
      );
    }

    const nextState = this.machine.transition(
      this.state,
      eventObject,
      this.state.context
    );

    return nextState;
  }
  private forward(event: Event<TEvent>): void {
    this.children.forEach(childInterpreter => childInterpreter.send(event));
  }
  private defer(sendAction: SendAction<TContext, TEvent>): number {
    return this.clock.setTimeout(
      this.sender(sendAction.event),
      sendAction.delay || 0
    );
  }
  private cancel(sendId: string | number): void {
    this.clock.clearTimeout(this.delayedEventsMap[sendId]);
    delete this.delayedEventsMap[sendId];
  }
  private exec(
    action: ActionObject<TContext>,
    context: TContext,
    event?: TEvent
  ): Partial<TContext> | undefined {
    if (action.exec) {
      return action.exec(context, event);
    }

    switch (action.type) {
      case actionTypes.send:
        const sendAction = action as SendAction<TContext, TEvent>;

        switch (sendAction.to) {
          case SpecialTargets.Parent:
            if (this.parent) {
              this.parent.send(sendAction.event);
            }
            break;
          default:
            if (!sendAction.delay) {
              this.eventQueue.push(sendAction.event);
            } else {
              this.delayedEventsMap[sendAction.id] = this.defer(sendAction);
            }

            break;
        }

      case actionTypes.cancel:
        this.cancel((action as CancelAction).sendId);

        break;
      case actionTypes.start: {
        const activity = (action as ActivityActionObject<TContext>)
          .activity as InvokeDefinition<TContext>;

        if (activity.type === ActionTypes.Invoke) {
          const service = activity.src
            ? activity.src instanceof StateNode
              ? activity.src
              : this.machine.options.services
                ? this.machine.options.services[activity.src]
                : undefined
            : undefined;
          const { id } = activity;

          const autoForward = !!activity.forward;

          if (!service) {
            // tslint:disable-next-line:no-console
            console.warn(`No service found for invocation '${activity.src}'`);
            return;
          }

          if (typeof service !== 'string') {
            // TODO: try/catch here
            const childMachine =
              service instanceof StateNode ? service : Machine(service);
            const interpreter = this.spawn(childMachine, {
              id,
              autoForward
            }).onDone(this.sender(doneInvoke(activity.id)));
            interpreter.start();

            this.activitiesMap[activity.id] = () => {
              this.children.delete(interpreter);
              interpreter.stop();
            };
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
          this.activitiesMap[activity.id] = implementation(context, activity);
        }

        break;
      }
      case actionTypes.stop: {
        const { activity } = action as ActivityActionObject<TContext>;
        const dispose = this.activitiesMap[activity.id];

        if (dispose) {
          dispose();
        }

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
  private spawn<
    TChildContext,
    TChildStateSchema,
    TChildEvents extends EventObject
  >(
    machine: XSMachine<TChildContext, TChildStateSchema, TChildEvents>,
    options: { id?: string; autoForward?: boolean } = {}
  ): Interpreter<TChildContext, TChildStateSchema, TChildEvents> {
    const childInterpreter = new Interpreter(machine, {
      parent: this,
      id: options.id || machine.id
    });

    if (options.autoForward) {
      this.children.add(childInterpreter);
    }

    return childInterpreter;
  }
  private flushEventQueue() {
    const flushedEvent = this.eventQueue.shift();
    if (flushedEvent) {
      this.send(flushedEvent);
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
  machine: XSMachine<TContext, TStateSchema, TEvent>,
  options?: Partial<InterpreterOptions>
) {
  const interpreter = new Interpreter(machine, options);

  return interpreter;
}
