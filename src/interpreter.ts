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
  ServiceConfig
} from './types';
import { State } from './State';
import * as actionTypes from './actionTypes';
import { toEventObject, doneInvoke, error } from './actions';
import { Machine } from './Machine';
import { StateNode } from './StateNode';
import { mapContext } from './utils';

export type StateListener<TContext, TEvent extends EventObject> = (
  state: State<TContext>,
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
  public static defaultOptions: InterpreterOptions = (global => ({
    clock: {
      setTimeout: (fn, ms) => {
        return global.setTimeout.call(null, fn, ms);
      },
      clearTimeout: id => {
        return global.clearTimeout.call(null, id);
      }
    },
    logger: global.console.log.bind(console)
  }))(typeof window === 'undefined' ? global : window);
  /**
   * The current state of the interpreted machine.
   */
  public state: State<TContext, TEvent>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;

  private eventQueue: Array<OmniEventObject<TEvent>> = [];
  private delayedEventsMap: Record<string, number> = {};
  private activitiesMap: Record<string, any> = {};
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
  private children: Map<string, Interpreter<any>> = new Map();
  private forwardTo: Set<string> = new Set();
  public id: string;

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

    this.clock = resolvedOptions.clock;
    this.logger = resolvedOptions.logger;
    this.parent = resolvedOptions.parent;
    this.id = resolvedOptions.id || `${Math.round(Math.random() * 99999)}`;
  }
  public static interpret = interpret;
  /**
   * The initial state of the statechart.
   */
  public get initialState(): State<TContext, TEvent> {
    return this.machine.initialState;
  }
  private update(
    state: State<TContext, TEvent>,
    event: Event<TEvent> | OmniEventObject<TEvent>
  ): void {
    this.state = state;
    const { context } = this.state;
    const eventObject: OmniEventObject<TEvent> = toEventObject<
      OmniEventObject<TEvent>
    >(event);

    this.state.actions.forEach(action => {
      this.exec(action, context, eventObject);
    }, context);

    if (eventObject) {
      this.eventListeners.forEach(listener => listener(eventObject));
    }

    this.listeners.forEach(listener => listener(state, eventObject));
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

    this.flushEventQueue();
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
    initialState: State<TContext, TEvent> = this.machine.initialState as State<
      TContext,
      TEvent
    >
  ): Interpreter<TContext, TStateSchema, TEvent> {
    this.initialized = true;
    this.update(initialState, { type: actionTypes.init });
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

    // Stop all activities
    Object.keys(this.activitiesMap).forEach(activityId => {
      this.stopActivity(activityId);
    });

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
  };

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

    target.send(event);
  };
  /**
   * Returns the next state given the interpreter's current state and the event.
   *
   * This is a pure method that does _not_ update the interpreter's state.
   *
   * @param event The event to determine the next state
   */
  public nextState(event: OmniEvent<TEvent>): State<TContext, TEvent> {
    const eventObject = toEventObject<OmniEventObject<TEvent>>(event);

    if (!this.initialized) {
      throw new Error(
        `Unable to send event "${
          eventObject.type
        }" to an uninitialized service (ID: ${
          this.machine.id
        }). Make sure .start() is called for this service.\nEvent: ${JSON.stringify(
          event
        )}`
      );
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
  private defer(sendAction: SendActionObject<TContext, TEvent>): number {
    return this.clock.setTimeout(() => {
      if (sendAction.to) {
        this.sendTo(sendAction.event, sendAction.to);
      } else {
        this.send(sendAction.event);
      }
    }, sendAction.delay || 0);
  }
  private cancel(sendId: string | number): void {
    this.clock.clearTimeout(this.delayedEventsMap[sendId]);
    delete this.delayedEventsMap[sendId];
  }
  private exec(
    action: ActionObject<TContext>,
    context: TContext,
    event: OmniEventObject<TEvent>
  ): void {
    if (action.exec) {
      return action.exec(context, event, { action });
    }

    switch (action.type) {
      case actionTypes.send:
        const sendAction = action as SendActionObject<TContext, TEvent>;

        if (sendAction.delay) {
          this.delayedEventsMap[sendAction.id] = this.defer(sendAction);
          return;
        } else {
          if (sendAction.to) {
            this.sendTo(sendAction.event, sendAction.to);
          } else {
            this.eventQueue.push(sendAction.event);
          }
        }
        break;

      case actionTypes.cancel:
        this.cancel((action as CancelAction).sendId);

        break;
      case actionTypes.start: {
        const activity = (action as ActivityActionObject<TContext>)
          .activity as InvokeDefinition<TContext, TEvent>;

        // Invoked services
        if (activity.type === ActionTypes.Invoke) {
          const service: ServiceConfig<TContext> | undefined = activity.src
            ? activity.src instanceof StateNode
              ? activity.src
              : typeof activity.src === 'function'
              ? activity.src
              : this.machine.options.services
              ? this.machine.options.services[activity.src]
              : undefined
            : undefined;

          const { id, data } = activity;

          const autoForward = !!activity.forward;

          if (!service) {
            // tslint:disable-next-line:no-console
            console.warn(
              `No service found for invocation '${activity.src}' in machine '${
                this.machine.id
              }'.`
            );
            return;
          }

          if (typeof service === 'function') {
            const promiseOrCallback = service(context, event);

            if (promiseOrCallback instanceof Promise) {
              let canceled = false;

              promiseOrCallback
                .then(response => {
                  if (!canceled) {
                    this.send(doneInvoke(id, response));
                  }
                })
                .catch(errorData => {
                  // Send "error.execution" to this (parent).
                  this.send(error(errorData, id));
                });

              this.activitiesMap[id] = () => {
                canceled = true;
              };
            } else {
              const dispose = promiseOrCallback(this.send.bind(this));

              this.activitiesMap[id] = () => {
                if (dispose && typeof dispose === 'function') {
                  dispose();
                }
              };
            }
          } else if (typeof service !== 'string') {
            // TODO: try/catch here
            const childMachine =
              service instanceof StateNode ? service : Machine(service);
            const interpreter = this.spawn(
              data
                ? childMachine.withContext(
                    mapContext(data, context, event as TEvent)
                  )
                : childMachine,
              {
                id,
                autoForward
              }
            ).onDone(doneEvent => {
              this.send(doneEvent as OmniEvent<TEvent>); // todo: fix
            });
            interpreter.start();

            this.activitiesMap[activity.id] = () => {
              this.children.delete(interpreter.id);
              this.forwardTo.delete(interpreter.id);
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
        this.stopActivity(action.activity.id);

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
  private stopActivity(activityId: string): void {
    const dispose = this.activitiesMap[activityId];

    if (dispose && typeof dispose === 'function') {
      dispose();
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
    const childInterpreter = new Interpreter(machine, {
      parent: this,
      id: options.id || machine.id
    });

    this.children.set(childInterpreter.id, childInterpreter);

    if (options.autoForward) {
      this.forwardTo.add(childInterpreter.id);
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
  machine: StateMachine<TContext, TStateSchema, TEvent>,
  options?: Partial<InterpreterOptions>
) {
  const interpreter = new Interpreter<TContext, TStateSchema, TEvent>(
    machine,
    options
  );

  return interpreter;
}
