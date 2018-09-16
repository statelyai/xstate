import {
  Machine,
  Event,
  EventObject,
  SendAction,
  CancelAction,
  DefaultContext,
  ActionObject,
  StateSchema
} from './types';
import { State } from './State';
import * as actionTypes from './actionTypes';
import { toEventObject } from './actions';

export type StateListener = <TContext = DefaultContext>(
  state: State<TContext>
) => void;

export type ContextListener<TContext = DefaultContext> = (
  context: TContext,
  prevContext: TContext | undefined
) => void;

export type Listener = () => void;

export interface Clock {
  setTimeout(fn: (...args: any[]) => void, timeout: number): number;
  clearTimeout(id: number): void;
}

export interface SimulatedClock extends Clock {
  start(speed: number): void;
  increment(ms: number): void;
  set(ms: number): void;
}

interface InterpreterOptions {
  clock: Clock;
  logger: (...args: any[]) => void;
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

// tslint:disable-next-line:max-classes-per-file
export class Interpreter<
  TContext,
  TStateSchema extends StateSchema = any,
  TEvents extends EventObject = EventObject
> {
  // TODO: fixme
  public static defaultOptions: InterpreterOptions = {
    clock: { setTimeout, clearTimeout },
    logger: global.console.log.bind(console)
  };
  public state: State<TContext, TEvents>;
  public extState: TContext;
  public eventQueue: TEvents[] = [];
  public delayedEventsMap: Record<string, number> = {};
  public listeners: Set<StateListener> = new Set();
  public contextListeners: Set<ContextListener<TContext>> = new Set();
  public stopListeners: Set<Listener> = new Set();
  public clock: Clock;
  public logger: (...args: any[]) => void;
  public initialized = false;
  constructor(
    public machine: Machine<TContext, TStateSchema, TEvents>,
    listener?: StateListener,
    options: Partial<InterpreterOptions> = Interpreter.defaultOptions
  ) {
    if (listener) {
      this.onTransition(listener);
    }

    const resolvedOptions: InterpreterOptions = {
      ...Interpreter.defaultOptions,
      ...options
    };

    this.clock = resolvedOptions.clock;
    this.logger = resolvedOptions.logger;
  }
  public static interpret = interpret;
  private update(
    state: State<TContext, TEvents>,
    event?: Event<TEvents>
  ): void {
    this.state = state;
    const { context } = this.state;

    this.state.actions.forEach(action => {
      this.exec(action, context, event ? toEventObject(event) : undefined);
    }, context);

    this.listeners.forEach(listener => listener(state));
    this.contextListeners.forEach(ctxListener =>
      ctxListener(
        this.state.context,
        this.state.history ? this.state.history.context : undefined
      )
    );
  }
  /*
   * Adds a listener that is called whenever a state transition happens.
   * @param listener The listener to add
   */
  public onTransition(listener: StateListener): Interpreter<TContext> {
    this.listeners.add(listener);
    return this;
  }
  public onChange(listener: ContextListener<TContext>): Interpreter<TContext> {
    this.contextListeners.add(listener);
    return this;
  }
  public onStop(listener: Listener): Interpreter<TContext> {
    this.stopListeners.add(listener);
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
  public init = this.start;
  public start(
    initialState: State<TContext, TEvents> = this.machine.initialState as State<
      TContext,
      TEvents
    >
  ): Interpreter<TContext> {
    this.update(initialState);
    this.initialized = true;
    return this;
  }
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
    return this;
  }
  public send = (event: Event<TEvents>): State<TContext, TEvents> => {
    const eventObject = toEventObject(event);
    if (!this.initialized) {
      throw new Error(
        `Unable to send event "${
          eventObject.type
        }" to an uninitialized interpreter.`
      );
    }
    const nextState = this.machine.transition(
      this.state,
      eventObject,
      this.extState
    ) as State<TContext, TEvents>; // TODO: fixme

    this.update(nextState, event);
    this.flushEventQueue();
    return nextState;
    // tslint:disable-next-line:semicolon
  };
  private defer(sendAction: SendAction<TContext, TEvents>): number {
    return this.clock.setTimeout(
      () => this.send(sendAction.event),
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
    event?: TEvents
  ): Partial<TContext> | undefined {
    if (action.exec) {
      return action.exec(context, event);
    }

    switch (action.type) {
      case actionTypes.send:
        const sendAction = action as SendAction<TContext, TEvents>;

        if (!sendAction.delay) {
          this.eventQueue.push(sendAction.event);
        } else {
          this.delayedEventsMap[sendAction.id] = this.defer(sendAction);
        }

        break;
      case actionTypes.cancel:
        this.cancel((action as CancelAction).sendId);

        break;
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
  private flushEventQueue() {
    const flushedEvent = this.eventQueue.shift();
    if (flushedEvent) {
      this.send(flushedEvent);
    }
  }
}

export function interpret<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvents extends EventObject = EventObject
>(
  machine: Machine<TContext, TStateSchema, TEvents>,
  listener?: StateListener,
  options?: Partial<InterpreterOptions>
) {
  return new Interpreter(machine, listener, options);
}
