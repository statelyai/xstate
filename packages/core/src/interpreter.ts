import {
  Event,
  EventObject,
  CancelActionObject,
  SpecialTargets,
  SendActionObject,
  StateValue,
  InterpreterOptions,
  DoneEvent,
  Subscription,
  ActionFunctionMap,
  SCXML,
  Observer,
  InvokeActionObject,
  AnyEventObject,
  ActorRef,
  SCXMLErrorEvent,
  InvokeSourceDefinition,
  StateConfig,
  TODO
} from './types';
import { State, isStateConfig } from './State';
import * as actionTypes from './actionTypes';
import { doneInvoke, error } from './actions';
import { IS_PRODUCTION } from './environment';
import {
  mapContext,
  warn,
  keys,
  isFunction,
  toSCXMLEvent,
  symbolObservable,
  isSCXMLErrorEvent,
  toEventObject
} from './utils';
import { isActorRef } from './actor';
import { isInFinalState } from './stateUtils';
import { registry } from './registry';
import type { StateMachine } from './StateMachine';
import { devToolsAdapter } from './dev';
// import { CapturedState } from './capturedState';
import type {
  ActionFunction,
  BaseActionObject,
  LogActionObject,
  MachineContext,
  PayloadSender,
  StopActionObject,
  Subscribable
} from './types';
import { isExecutableAction } from '../actions/ExecutableAction';
import { Mailbox } from './Mailbox';

export type StateListener<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (state: State<TContext, TEvent>, event: TEvent) => void;

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

const defaultOptions: InterpreterOptions = ((global) => ({
  deferEvents: true,
  clock: {
    setTimeout: (fn, ms) => {
      return setTimeout(fn, ms);
    },
    clearTimeout: (id) => {
      return clearTimeout(id);
    }
  },
  logger: global.console.log.bind(console),
  devTools: false
}))(typeof window === 'undefined' ? global : window);

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}

export class Interpreter<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject
> {
  /**
   * The current state of the interpreted machine.
   */
  private _state?: State<TContext, TEvent>;
  private _initialState?: State<TContext, TEvent>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;
  public options: Readonly<InterpreterOptions>;

  public id: string;
  private mailbox: Mailbox<SCXML.Event<TEvent>> = new Mailbox(
    this._process.bind(this)
  );
  private delayedEventsMap: Record<string, number> = {};
  private listeners: Set<StateListener<TContext, TEvent>> = new Set();
  private stopListeners: Set<Listener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private doneListeners: Set<EventListener> = new Set();
  private logger: (...args: any[]) => void;
  /**
   * Whether the service is started.
   */
  public status: InterpreterStatus = InterpreterStatus.NotStarted;

  // Actor Ref
  public parent?: ActorRef<any>;
  public name: string;
  public ref: ActorRef<TEvent>;

  /**
   * The globally unique process ID for this invocation.
   */
  public sessionId: string;
  private forwardTo: Set<string> = new Set();

  /**
   * Creates a new Interpreter instance (i.e., service) for the given machine with the provided options, if any.
   *
   * @param machine The machine to be interpreted
   * @param options Interpreter options
   */
  constructor(
    public machine: StateMachine<TContext, TEvent>,
    options?: Partial<InterpreterOptions>
  ) {
    const resolvedOptions: InterpreterOptions = {
      ...defaultOptions,
      ...options
    };

    const { clock, logger, parent, id } = resolvedOptions;

    const resolvedId = id !== undefined ? id : machine.key;

    this.name = this.id = resolvedId;
    this.logger = logger;
    this.clock = clock;
    this.parent = parent;

    this.options = resolvedOptions;

    this.ref = this;

    this.sessionId = this.ref.name;
  }

  public get initialized() {
    return this.status === InterpreterStatus.Running;
  }

  public get initialState(): State<TContext, TEvent> {
    const initialState =
      this._initialState ||
      ((this._initialState = this.machine.getInitialState()),
      this._initialState);
    return initialState;
  }

  public get state(): State<TContext, TEvent> {
    return this._state!;
  }

  /**
   * Executes the actions of the given state, with that state's `context` and `event`.
   *
   * @param state The state whose actions will be executed
   */
  public execute(state: State<TContext, TEvent>): void {
    for (const action of state.actions) {
      this.exec(action, state);
    }
  }

  private update(state: State<TContext, TEvent>): void {
    // Attach session ID to state
    state._sessionid = this.sessionId;

    // Update state
    this._state = state;
    // Execute actions
    this.execute(this.state);

    for (const listener of this.listeners) {
      listener(state, state.event);
    }

    const isDone = isInFinalState(state.configuration || [], this.machine.root);

    if (this.state.configuration && isDone) {
      // get final child state node
      const finalChildStateNode = state.configuration.find(
        (stateNode) =>
          stateNode.type === 'final' && stateNode.parent === this.machine.root
      );

      const doneData =
        finalChildStateNode && finalChildStateNode.doneData
          ? mapContext(
              finalChildStateNode.doneData,
              state.context,
              state._event
            )
          : undefined;

      for (const listener of this.doneListeners) {
        listener(
          toSCXMLEvent(doneInvoke(this.name, doneData), { invokeid: this.name })
        );
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
  public onTransition(listener: StateListener<TContext, TEvent>): this {
    this.listeners.add(listener);

    // Send current state to listener
    if (this.status === InterpreterStatus.Running) {
      listener(this.state, this.state.event);
    }

    return this;
  }

  public subscribe(
    nextListener?: (state: State<TContext, TEvent>) => void,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription;
  public subscribe(observer: Observer<State<TContext, TEvent>>): Subscription;
  public subscribe(
    nextListenerOrObserver?:
      | ((state: State<TContext, TEvent>) => void)
      | Observer<State<TContext, TEvent>>,
    errorListener?: (error: Error) => void,
    completeListener?: () => void
  ): Subscription {
    if (!nextListenerOrObserver) {
      return { unsubscribe: () => void 0 };
    }

    let listener: (state: State<TContext, TEvent>) => void;
    let resolvedCompleteListener = completeListener;

    if (typeof nextListenerOrObserver === 'function') {
      listener = nextListenerOrObserver;
    } else {
      listener = nextListenerOrObserver.next?.bind(nextListenerOrObserver);
      resolvedCompleteListener = nextListenerOrObserver.complete?.bind(
        nextListenerOrObserver
      );
    }

    if (listener) {
      this.listeners.add(listener);
    }

    if (errorListener) {
      this.onError(errorListener);
    }

    // Send current state to listener
    if (this.status === InterpreterStatus.Running) {
      listener(this.state);
    }

    if (resolvedCompleteListener) {
      this.onDone(resolvedCompleteListener);
    }

    return {
      unsubscribe: () => {
        listener && this.off(listener);
        resolvedCompleteListener && this.off(resolvedCompleteListener);
        errorListener && this.off(errorListener);
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

  private handleErrorEvent(errorEvent: SCXMLErrorEvent): void {
    if (this.errorListeners.size > 0) {
      this.errorListeners.forEach((listener) => {
        listener(errorEvent.data.data);
      });
    } else {
      this.stop();
      throw errorEvent.data.data;
    }
  }

  /**
   * Adds a state listener that is notified when the statechart has reached its final state.
   * @param listener The state listener
   */
  public onDone(
    listener: EventListener<DoneEvent>
  ): Interpreter<TContext, TEvent> {
    this.doneListeners.add(listener);
    return this;
  }

  /**
   * Removes a listener.
   * @param listener The listener to remove
   */
  public off(
    listener: (...args: any[]) => void
  ): Interpreter<TContext, TEvent> {
    this.listeners.delete(listener);
    this.stopListeners.delete(listener);
    this.doneListeners.delete(listener);
    this.errorListeners.delete(listener);
    return this;
  }

  /**
   * Starts the interpreter from the given state, or the initial state.
   * @param initialState The state to start the statechart from
   */
  public start(
    initialState?:
      | State<TContext, TEvent>
      | StateConfig<TContext, TEvent>
      | StateValue
  ): Interpreter<TContext, TEvent> {
    if (this.status === InterpreterStatus.Running) {
      // Do not restart the service if it is already started
      return this;
    }

    registry.register(this.sessionId, this.ref);
    this.status = InterpreterStatus.Running;

    const resolvedState =
      initialState === undefined
        ? this.machine.getInitialState()
        : isStateConfig<TContext, TEvent>(initialState)
        ? this.machine.resolveState(initialState)
        : this.machine.resolveState(
            State.from(initialState, this.machine.context)
          );
    this._state = resolvedState;

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
    const nextState = this.nextState(event);
    this.update(nextState);
  }

  /**
   * Stops the interpreter and unsubscribe all listeners.
   *
   * This will also notify the `onStop` listeners.
   */
  public stop(): Interpreter<TContext, TEvent> {
    this.listeners.clear();
    for (const listener of this.stopListeners) {
      // call listener, then remove
      listener();
    }
    this.stopListeners.clear();
    this.doneListeners.clear();

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
    Object.values(this.state.children).forEach((child) => {
      if (isFunction(child.stop)) {
        child.stop();
      }
    });

    // Cancel all delayed events
    for (const key of keys(this.delayedEventsMap)) {
      this.clock.clearTimeout(this.delayedEventsMap[key]);
    }

    this.mailbox.clear();
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
  public send: PayloadSender<TEvent> = (event, payload?): void => {
    const eventObject = toEventObject(event, payload);
    const _event = toSCXMLEvent(eventObject);

    if (this.status === InterpreterStatus.Stopped) {
      // do nothing
      if (!IS_PRODUCTION) {
        warn(
          false,
          `Event "${_event.name}" was sent to stopped service "${
            this.machine.key
          }". This service has already reached its final state, and will not transition.\nEvent: ${JSON.stringify(
            _event.data
          )}`
        );
      }
      return;
    }

    if (
      this.status !== InterpreterStatus.Running &&
      !this.options.deferEvents
    ) {
      throw new Error(
        `Event "${_event.name}" was sent to uninitialized service "${
          this.machine.key
          // tslint:disable-next-line:max-line-length
        }". Make sure .start() is called for this service, or set { deferEvents: true } in the service options.\nEvent: ${JSON.stringify(
          _event.data
        )}`
      );
    }

    this.mailbox.enqueue(_event);
  };

  private sendTo(
    event: SCXML.Event<AnyEventObject>,
    to: string | ActorRef<any>
  ) {
    const isParent = this.parent && to === SpecialTargets.Parent;
    const target = isParent
      ? this.parent
      : isActorRef(to)
      ? to
      : this.state.children[to];

    if (!target) {
      if (!isParent) {
        const executionError = new Error(
          `Unable to send event to child '${to}' from service '${this.name}'.`
        );
        this.send(
          toSCXMLEvent<TEvent>(actionTypes.errorExecution, {
            data: executionError as any // TODO: refine
          }) as any // TODO: fix
        );
      }

      // tslint:disable-next-line:no-console
      if (!IS_PRODUCTION) {
        warn(
          false,
          `Service '${this.name}' has no parent: unable to send event ${event.type}`
        );
      }
      return;
    }

    target.send({
      ...event,
      name:
        event.name === actionTypes.error ? `${error(this.name)}` : event.name,
      origin: this
    });
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
  ): State<TContext, TEvent> {
    const _event = toSCXMLEvent(event);

    if (
      isSCXMLErrorEvent(_event) &&
      !this.state.nextEvents.some((nextEvent) => nextEvent === _event.name)
    ) {
      this.handleErrorEvent(_event);
    }

    return this.machine.transition(this.state, event);
  }
  private forward(event: SCXML.Event<TEvent>): void {
    for (const id of this.forwardTo) {
      const child = this.state.children[id];

      if (!child) {
        throw new Error(
          `Unable to forward event '${event.name}' from interpreter '${this.name}' to nonexistant child '${id}'.`
        );
      }

      child.send(event);
    }
  }
  private defer(sendAction: SendActionObject): void {
    this.delayedEventsMap[sendAction.params.id] = this.clock.setTimeout(() => {
      if (sendAction.params.to) {
        this.sendTo(sendAction.params._event, sendAction.params.to);
      } else {
        this.send(sendAction.params._event as SCXML.Event<TEvent>);
      }
    }, sendAction.params.delay as number);
  }
  private cancel(sendId: string | number): void {
    this.clock.clearTimeout(this.delayedEventsMap[sendId]);
    delete this.delayedEventsMap[sendId];
  }
  private getActionFunction(
    actionType: string
  ): BaseActionObject | ActionFunction<TContext, TEvent> | undefined {
    return (
      this.machine.options.actions[actionType] ??
      ({
        [actionTypes.send]: (_ctx, _e, { action }) => {
          const sendAction = action as SendActionObject;

          if (typeof sendAction.params.delay === 'number') {
            this.defer(sendAction);
            return;
          } else {
            if (sendAction.params.to) {
              this.sendTo(sendAction.params._event, sendAction.params.to);
            } else {
              this.send(sendAction.params._event as SCXML.Event<TEvent>);
            }
          }
        },
        [actionTypes.cancel]: (_ctx, _e, { action }) => {
          this.cancel((action as CancelActionObject).params.sendId);
        },
        [actionTypes.invoke]: (_ctx, _e, { action, state }) => {
          const {
            id,
            autoForward,
            ref
          } = (action as InvokeActionObject).params;
          if (!ref) {
            if (!IS_PRODUCTION) {
              warn(
                false,
                `Actor type '${
                  ((action as InvokeActionObject).params
                    .src as InvokeSourceDefinition).type
                }' not found in machine '${this.machine.key}'.`
              );
            }
            return;
          }

          ref.parent = this; // TODO: fix
          // If the actor will be stopped right after it's started
          // (such as in transient states) don't bother starting the actor.
          if (
            state.actions.find((otherAction) => {
              return (
                otherAction.type === actionTypes.stop &&
                (otherAction as StopActionObject).params.actor === id
              );
            })
          ) {
            return;
          }
          try {
            if (autoForward) {
              this.forwardTo.add(id);
            }

            this.state.children[id] = ref;

            ref.subscribe({
              next: (data) => {
                this.send(data as TODO);
              },
              error: (errorData) => {
                this.send(errorData as TODO);
                // TODO: handle error
                this.stop();
              },
              complete: () => {
                this.send(
                  toSCXMLEvent(doneInvoke(id) as any, {
                    origin: ref
                  })
                );
                /* ... */
              },
              done: (doneData) => {
                this.send(
                  toSCXMLEvent(doneInvoke(id, doneData) as any, {
                    origin: ref
                  })
                );
              }
            });

            ref.start?.();
          } catch (err) {
            this.send(error(id, err));
            return;
          }
        },
        [actionTypes.stop]: (_ctx, _e, { action }) => {
          const { actor } = (action as StopActionObject).params;
          const actorRef =
            typeof actor === 'string' ? this.state.children[actor] : actor;

          if (actorRef) {
            this.stopChild(actorRef.name);
          }
        },
        [actionTypes.log]: (_ctx, _e, { action }) => {
          const { label, value } = (action as LogActionObject).params;

          if (label) {
            this.logger(label, value);
          } else {
            this.logger(value);
          }
        }
      } as ActionFunctionMap<TContext, TEvent>)[actionType]
    );
  }
  private exec(
    action: InvokeActionObject | BaseActionObject,
    state: State<TContext, TEvent>
  ): void {
    const { _event } = state;

    if (isExecutableAction(action)) {
      try {
        return action.execute(state);
      } catch (err) {
        this.parent?.send({
          type: 'xstate.error',
          data: err
        });

        throw err;
      }
    }

    const actionOrExec = this.getActionFunction(action.type);
    const exec = isFunction(actionOrExec) ? actionOrExec : undefined;

    if (exec) {
      try {
        return exec(state.context, _event.data, {
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

    if (!IS_PRODUCTION && !action.type?.startsWith('xstate.')) {
      warn(false, `No implementation found for action type '${action.type}'`);
    }

    return undefined;
  }

  private stopChild(childId: string): void {
    const child = this.state.children[childId];
    if (!child) {
      return;
    }

    this.forwardTo.delete(childId);
    delete this.state.children[childId];

    if (isFunction(child.stop)) {
      child.stop();
    }
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

  public [symbolObservable](): Subscribable<State<TContext, TEvent>> {
    return this;
  }

  // this gets stripped by Babel to avoid having "undefined" property in environments without this non-standard Symbol
  // it has to be here to be included in the generated .d.ts
  public [Symbol.observable](): Subscribable<State<TContext, TEvent>> {
    return this;
  }

  public getSnapshot() {
    if (this.status === InterpreterStatus.NotStarted) {
      return this.initialState;
    }
    return this._state!;
  }
}

/**
 * Creates a new Interpreter instance for the given machine with the provided options, if any.
 *
 * @param machine The machine to interpret
 * @param options Interpreter options
 */
export function interpret<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject
>(
  machine: StateMachine<TContext, TEvent>,
  options?: Partial<InterpreterOptions>
) {
  const interpreter = new Interpreter<TContext, TEvent>(machine, options);

  return interpreter;
}
