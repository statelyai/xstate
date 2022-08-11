import { AnyStateMachine, InterpreterFrom } from '.';
import { isExecutableAction } from '../actions/ExecutableAction';
import { doneInvoke, error, toActionObjects, initEvent } from './actions';
import * as actionTypes from './actionTypes';
import { isActorRef } from './actors';
import { devToolsAdapter } from './dev';
import { IS_PRODUCTION } from './environment';
import { Mailbox } from './Mailbox';
import { registry } from './registry';
import { isStateConfig, State } from './State';
import type { StateMachine } from './StateMachine';
import {
  TypegenDisabled,
  AreAllImplementationsAssumedToBeProvided
} from './typegenTypes';
import type {
  ActionFunction,
  BaseActionObject,
  LogActionObject,
  MachineContext,
  PayloadSender
} from './types';
import {
  ActionFunctionMap,
  ActorRef,
  AnyEventObject,
  CancelActionObject,
  DoneEvent,
  Event,
  EventObject,
  InteropSubscribable,
  InterpreterOptions,
  InvokeActionObject,
  InvokeSourceDefinition,
  Observer,
  SCXML,
  SendActionObject,
  SpecialTargets,
  StateValue,
  StopActionObject,
  Subscription
} from './types';
import {
  isFunction,
  isSCXMLErrorEvent,
  mapContext,
  symbolObservable,
  toEventObject,
  toSCXMLEvent,
  warn,
  toObserver,
  flatten
} from './utils';
import { resolveActionsAndContext } from './stateUtils';

export type StateListener<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TResolvedTypesMeta = TypegenDisabled
> = (state: State<TContext, TEvent, TResolvedTypesMeta>, event: TEvent) => void;

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

export class Interpreter<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject,
  TResolvedTypesMeta = TypegenDisabled
> implements ActorRef<TEvent, State<TContext, TEvent, TResolvedTypesMeta>> {
  /**
   * The current state of the interpreted machine.
   */
  private _state?: State<TContext, TEvent, TResolvedTypesMeta>;
  private _initialState?: State<TContext, TEvent, TResolvedTypesMeta>;
  /**
   * The clock that is responsible for setting and clearing timeouts, such as delayed events and transitions.
   */
  public clock: Clock;
  public options: Readonly<InterpreterOptions>;

  public id: string;

  private mailbox: Mailbox<SCXML.Event<TEvent>> = new Mailbox(
    this._process.bind(this)
  );

  private delayedEventsMap: Record<string, unknown> = {};

  private listeners: Set<
    StateListener<TContext, TEvent, TResolvedTypesMeta>
  > = new Set();
  private stopListeners: Set<Listener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private doneListeners: Set<EventListener> = new Set();
  private logger: (...args: any[]) => void;
  /**
   * Whether the service is started.
   */
  public status: InterpreterStatus = InterpreterStatus.NotStarted;

  // Actor Ref
  public _parent?: ActorRef<any>;
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
    public machine: StateMachine<
      TContext,
      TEvent,
      any,
      any,
      TResolvedTypesMeta
    >,
    options?: InterpreterOptions
  ) {
    const resolvedOptions = {
      ...defaultOptions,
      ...options
    } as Required<InterpreterOptions>;

    const { clock, logger, parent, id } = resolvedOptions;

    const resolvedId = id !== undefined ? id : machine.key;

    this.name = this.id = resolvedId;
    this.logger = logger;
    this.clock = clock;
    this._parent = parent;

    this.options = resolvedOptions;

    this.ref = this;

    this.sessionId = this.ref.name;
  }

  public get initialized() {
    return this.status === InterpreterStatus.Running;
  }

  public get initialState(): State<TContext, TEvent, TResolvedTypesMeta> {
    const initialState =
      this._initialState ||
      ((this._initialState = this.machine.getInitialState()),
      this._initialState);
    return initialState;
  }

  public get state(): State<TContext, TEvent, TResolvedTypesMeta> {
    return this._state!;
  }

  /**
   * Executes the actions of the given state, with that state's `context` and `event`.
   *
   * @param state The state whose actions will be executed
   */
  public execute(state: State<TContext, TEvent, TResolvedTypesMeta>): void {
    for (const action of state.actions) {
      this.exec(action, state);
    }
  }

  private update(state: State<TContext, TEvent, any>): void {
    // Attach session ID to state
    state._sessionid = this.sessionId;

    // Update state
    this._state = state;

    if (
      !this.machine.config.predictableActionArguments ||
      // this is currently required to execute initial actions as the `initialState` gets cached
      // we can't just recompute it (and execute actions while doing so) because we try to preserve identity of actors created within initial assigns
      this.state._event === initEvent
    ) {
      this.execute(this.state);
    } else {
      for (const action of state.actions) {
        if (action.type === actionTypes.invoke) {
          this.exec(action, this.state);
        }
      }
    }

    for (const listener of this.listeners) {
      listener(state, state.event);
    }

    if (this.state.done) {
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
      this._stop();
    }
  }
  /*
   * Adds a listener that is notified whenever a state transition happens. The listener is called with
   * the next state and the event object that caused the state transition.
   *
   * @param listener The state listener
   */
  public onTransition(
    listener: StateListener<TContext, TEvent, TResolvedTypesMeta>
  ): this {
    this.listeners.add(listener);

    // Send current state to listener
    if (this.status === InterpreterStatus.Running) {
      listener(this.state, this.state.event);
    }

    return this;
  }

  public subscribe(
    observer: Observer<State<TContext, TEvent, TResolvedTypesMeta>>
  ): Subscription;
  public subscribe(
    nextListener?: (state: State<TContext, TEvent, TResolvedTypesMeta>) => void,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription;
  public subscribe(
    nextListenerOrObserver?:
      | ((state: State<TContext, TEvent, TResolvedTypesMeta>) => void)
      | Observer<State<TContext, TEvent, TResolvedTypesMeta>>,
    errorListener?: (error: any) => void,
    completeListener?: () => void
  ): Subscription {
    const observer = toObserver(
      nextListenerOrObserver,
      errorListener,
      completeListener
    );

    this.listeners.add(observer.next);

    this.onError(observer.error);

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
   * Removes a listener.
   * @param listener The listener to remove
   */
  public off(listener: (...args: any[]) => void): this {
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
    initialState?: State<TContext, TEvent, TResolvedTypesMeta> | StateValue
  ): this {
    if (this.status === InterpreterStatus.Running) {
      // Do not restart the service if it is already started
      return this;
    }

    registry.register(this.sessionId, this.ref);
    this.status = InterpreterStatus.Running;

    const resolvedState =
      initialState === undefined
        ? this.initialState
        : isStateConfig<TContext, TEvent>(initialState)
        ? this.machine.resolveState(initialState as any) // TODO: fix this
        : this.machine.resolveState(
            State.from(initialState, this.machine.context)
          );

    this._state = resolvedState;

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
    // it feels weird to handle this here but we need to handle this even slightly "out of band"
    if (event.name === 'xstate.stop') {
      const exitActions = flatten(
        [...this.state.configuration]
          .sort((a, b) => b.order - a.order)
          .map((stateNode) =>
            toActionObjects(stateNode.exit, this.machine.options.actions as any)
          )
      );
      const {
        actions: resolvedActions,
        context: updatedContext
      } = resolveActionsAndContext(
        exitActions,
        this.machine,
        event,
        this.state,
        this.state.context,
        this.machine.config.predictableActionArguments ? this._exec : undefined
      );

      const prevState = this.state;

      const nextState = new State<TContext, TEvent, TResolvedTypesMeta>({
        value: prevState.value,
        context: updatedContext,
        _event: event,
        _sessionid: this.sessionId,
        historyValue: undefined,
        actions: resolvedActions,
        configuration: prevState.configuration,
        transitions: [],
        children: prevState.children,
        tags: prevState.tags,
        machine: this.machine
      });
      nextState.changed = true;
      this._state = nextState;

      this.execute(nextState);

      // TODO: think about converting those to actions
      // Stop all children
      Object.values(prevState.children).forEach((child) => {
        if (isFunction(child.stop)) {
          child.stop();
        }
      });

      registry.free(this.sessionId);
      return;
    }
    // TODO: handle errors
    this.forward(event);

    let errored = false;

    if (
      isSCXMLErrorEvent(event) &&
      !this.state.nextEvents.some((nextEvent) => nextEvent === event.name)
    ) {
      errored = true;
      // Error event unhandled by machine
      if (this.errorListeners.size > 0) {
        this.errorListeners.forEach((listener) => {
          listener(event.data.data);
        });
      } else {
        this.stop();
        throw event.data.data;
      }
    }

    const nextState = this._nextState(event);

    this.update(nextState);

    if (errored) {
      this.stop();
    }
  }

  private _stop() {
    this.listeners.clear();
    for (const listener of this.stopListeners) {
      // call listener, then remove
      listener();
    }
    this.stopListeners.clear();
    this.doneListeners.clear();

    if (this.status === InterpreterStatus.Stopped) {
      // Interpreter already stopped; do nothing
      return this;
    }

    this.status = InterpreterStatus.Stopped;
    this._initialState = undefined;

    // we are going to stop within the current sync frame
    // so we can safely just cancel this here as nothing async should be fired anyway
    for (const key of Object.keys(this.delayedEventsMap)) {
      this.clock.clearTimeout(this.delayedEventsMap[key]);
    }

    // clear everything that might be enqueued
    this.mailbox.clear();

    // TODO: after `stop` we must prepare ourselves for receiving events again
    // events sent *after* stop signal must be queued
    // it seems like this should be the common behavior for all of our consumers
    // so perhaps this should be unified somehow for all of them
    this.mailbox = new Mailbox(this._process.bind(this));
  }

  /**
   * Stops the interpreter and unsubscribe all listeners.
   *
   * This will also notify the `onStop` listeners.
   */
  public stop(): this {
    // TODO: add warning for stopping non-root interpreters

    // grab the current mailbox as it will be replaced in _stop
    // this is a good candidate for a refactor, ideally we wouldn't be recreating a mailbox
    const mailbox = this.mailbox;

    this._stop();

    mailbox.enqueue(toSCXMLEvent({ type: 'xstate.stop' }) as any);

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
    const isParent = this._parent && to === SpecialTargets.Parent;
    const target = isParent
      ? this._parent
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

    // perhaps those events should be rejected in the parent
    // but atm it doesn't have easy access to all of the information that is required to do it reliably
    if (
      this.status !== InterpreterStatus.Stopped ||
      this._parent !== target ||
      // we need to send events to the parent from exit handlers of a machine that reached its final state
      this.state.done
    ) {
      target.send({
        ...event,
        name:
          event.name === actionTypes.error ? `${error(this.name)}` : event.name,
        origin: this
      });
    }
  }
  public _nextState(
    event: Event<TEvent> | SCXML.Event<TEvent>
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    return this.machine._transition(
      this.state,
      event,
      this.machine.config.predictableActionArguments ? this._exec : undefined
    );
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
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    return this._nextState(event);
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
        [actionTypes.invoke]: (_ctx, _e, { action }) => {
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
          ref._parent = this; // TODO: fix
          // If the actor didn't end up being in the state
          // (eg. going through transient states could stop it) don't bother starting the actor.
          if (!this.state.children[id]) {
            return;
          }
          try {
            if (autoForward) {
              this.forwardTo.add(id);
            }

            ref.start?.();
          } catch (err) {
            this.send(error(id, err));
            return;
          }
        },
        [actionTypes.stop]: (_ctx, _e, { action }) => {
          const { actor } = (action as StopActionObject).params;

          if (actor) {
            this.stopChild(actor);
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

  private _exec = (
    action: InvokeActionObject | BaseActionObject,
    context: unknown,
    _event: SCXML.Event<TEvent>,
    state = this.state
  ) => {
    if (isExecutableAction(action)) {
      try {
        return action.execute(
          this.machine.config.predictableActionArguments
            ? ({
                context,
                _event,
                event: _event.data
              } as any)
            : state
        );
      } catch (err) {
        this._parent?.send({
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
        if (this._parent) {
          this._parent.send({
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
  };

  private exec(
    action: InvokeActionObject | BaseActionObject,
    state: State<TContext, TEvent, TResolvedTypesMeta>
  ): void {
    this._exec(action, state.context, state._event, state);
  }

  private stopChild(child: ActorRef<any, any>): void {
    this.forwardTo.delete(child.name);
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

  public [symbolObservable](): InteropSubscribable<
    State<TContext, TEvent, TResolvedTypesMeta>
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
): InterpreterFrom<TMachine> {
  const interpreter = new Interpreter(machine as AnyStateMachine, options);

  return interpreter as any;
}
