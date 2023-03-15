import { error, createInitEvent, initEvent } from './actions.js';
import { STATE_DELIMITER } from './constants.js';
import { createSpawner } from './spawn.js';
import { getPersistedState, State } from './State.js';
import { StateNode } from './StateNode.js';
import { interpret } from './interpreter.js';
import {
  getConfiguration,
  getInitialConfiguration,
  getStateNodes,
  isInFinalState,
  isStateId,
  macrostep,
  microstep,
  resolveActionsAndContext,
  resolveStateValue,
  transitionNode
} from './stateUtils.js';
import type {
  AreAllImplementationsAssumedToBeProvided,
  MarkAllImplementationsAsProvided,
  ResolveTypegenMeta,
  TypegenDisabled
} from './typegenTypes.js';
import type {
  ActorContext,
  ActorMap,
  BaseActionObject,
  ActorBehavior,
  EventObject,
  InternalMachineImplementations,
  InvokeActionObject,
  MachineConfig,
  MachineContext,
  MachineImplementationsSimplified,
  MachineSchema,
  NoInfer,
  SCXML,
  StateConfig,
  StateMachineDefinition,
  StateValue,
  TransitionDefinition,
  PersistedMachineState
} from './types.js';
import { isSCXMLErrorEvent, toSCXMLEvent } from './utils.js';

export const NULL_EVENT = '';
export const STATE_IDENTIFIER = '#';
export const WILDCARD = '*';

function createDefaultOptions() {
  return {
    actions: {},
    actors: {},
    delays: {},
    guards: {},
    context: {}
  };
}

export class StateMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject,
  TAction extends BaseActionObject = BaseActionObject,
  TActorMap extends ActorMap = ActorMap,
  TResolvedTypesMeta = ResolveTypegenMeta<
    TypegenDisabled,
    NoInfer<TEvent>,
    TAction,
    TActorMap
  >
> implements
    ActorBehavior<
      TEvent | SCXML.Event<TEvent>,
      State<TContext, TEvent, TResolvedTypesMeta>,
      State<TContext, TEvent, TResolvedTypesMeta>,
      PersistedMachineState<State<TContext, TEvent, TResolvedTypesMeta>>
    >
{
  // TODO: this getter should be removed
  public getContext(input?: any): TContext {
    return this.getContextAndActions(input)[0];
  }
  private getContextAndActions(
    actorCtx?: ActorContext<any, any>
  ): [TContext, InvokeActionObject[]] {
    const actions: InvokeActionObject[] = [];
    const { context } = this.config;
    const resolvedContext =
      typeof context === 'function'
        ? context({
            spawn: createSpawner(actorCtx?.self, this, actions),
            input: actorCtx?.input
          })
        : context;

    return [resolvedContext || ({} as TContext), actions];
  }
  /**
   * The machine's own version.
   */
  public version?: string;

  /**
   * The string delimiter for serializing the path to a string. The default is "."
   */
  public delimiter: string;

  public options: MachineImplementationsSimplified<TContext, TEvent>;

  public schema: MachineSchema<TContext, TEvent>;

  public __xstatenode: true = true;

  public idMap: Map<string, StateNode<TContext, TEvent>> = new Map();

  public root: StateNode<TContext, TEvent>;

  public id: string;

  public states: StateNode<TContext, TEvent>['states'];
  public events: Array<TEvent['type']>;

  constructor(
    /**
     * The raw config used to create the machine.
     */
    public config: MachineConfig<TContext, TEvent, any, any, any>,
    options?: MachineImplementationsSimplified<TContext, TEvent>
  ) {
    this.id = config.id || '(machine)';
    this.options = Object.assign(createDefaultOptions(), options);
    this.delimiter = this.config.delimiter || STATE_DELIMITER;
    this.version = this.config.version;
    this.schema = this.config.schema ?? ({} as any as this['schema']);
    this.transition = this.transition.bind(this);

    this.root = new StateNode(config, {
      _key: this.id,
      _machine: this
    });

    this.root._initialize();

    this.states = this.root.states; // TODO: remove!
    this.events = this.root.events;
  }

  /**
   * Clones this state machine with the provided implementations
   * and merges the `context` (if provided).
   *
   * @param implementations Options (`actions`, `guards`, `actors`, `delays`, `context`)
   *  to recursively merge with the existing options.
   *
   * @returns A new `StateMachine` instance with the provided implementations.
   */
  public provide(
    implementations: InternalMachineImplementations<
      TContext,
      TEvent,
      TResolvedTypesMeta,
      true
    >
  ): StateMachine<
    TContext,
    TEvent,
    TAction,
    TActorMap,
    AreAllImplementationsAssumedToBeProvided<TResolvedTypesMeta> extends false
      ? MarkAllImplementationsAsProvided<TResolvedTypesMeta>
      : TResolvedTypesMeta
  > {
    const { actions, guards, actors, delays } = this.options;

    return new StateMachine(this.config, {
      actions: { ...actions, ...implementations.actions },
      guards: { ...guards, ...implementations.guards },
      actors: { ...actors, ...implementations.actors },
      delays: { ...delays, ...implementations.delays }
    });
  }

  /**
   * Resolves the given `state` to a new `State` instance relative to this machine.
   *
   * This ensures that `.nextEvents` represent the correct values.
   *
   * @param state The state to resolve
   */
  public resolveState(
    state: State<TContext, TEvent, TResolvedTypesMeta>
  ): typeof state {
    const configurationSet = getConfiguration(
      getStateNodes(this.root, state.value)
    );
    const configuration = Array.from(configurationSet);
    return this.createState({
      ...state,
      value: resolveStateValue(this.root, state.value),
      configuration,
      done: isInFinalState(configuration)
    });
  }

  public resolveStateValue(
    stateValue: StateValue
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const resolvedStateValue = resolveStateValue(this.root, stateValue);
    const resolvedContext = this.getContext();

    return this.resolveState(
      State.from(resolvedStateValue, resolvedContext, this)
    );
  }

  /**
   * Determines the next state given the current `state` and received `event`.
   * Calculates a full macrostep from all microsteps.
   *
   * @param state The current State instance or state value
   * @param event The received event
   */
  public transition(
    state: State<TContext, TEvent, TResolvedTypesMeta> | StateValue = this
      .initialState,
    event: TEvent | SCXML.Event<TEvent>,
    actorCtx?: ActorContext<TEvent, State<TContext, TEvent, any>>
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const currentState =
      state instanceof State ? state : this.resolveStateValue(state);
    // TODO: handle error events in a better way
    const scxmlEvent = toSCXMLEvent(event);
    if (
      isSCXMLErrorEvent(scxmlEvent) &&
      !currentState.nextEvents.some(
        (nextEvent) => nextEvent === scxmlEvent.name
      )
    ) {
      throw scxmlEvent.data.data;
    }

    const { state: nextState } = macrostep(currentState, scxmlEvent, actorCtx);

    return nextState;
  }

  /**
   * Determines the next state given the current `state` and `event`.
   * Calculates a microstep.
   *
   * @param state The current state
   * @param event The received event
   */
  public microstep(
    state: State<TContext, TEvent, TResolvedTypesMeta> = this.initialState,
    event: TEvent | SCXML.Event<TEvent>,
    actorCtx?: ActorContext<any, any> | undefined
  ): Array<State<TContext, TEvent, TResolvedTypesMeta>> {
    const scxmlEvent = toSCXMLEvent(event);

    const { microstates } = macrostep(state, scxmlEvent, actorCtx);

    return microstates;
  }

  public getTransitionData(
    state: State<TContext, TEvent, TResolvedTypesMeta>,
    _event: SCXML.Event<TEvent>
  ): Array<TransitionDefinition<TContext, TEvent>> {
    return transitionNode(this.root, state.value, state, _event) || [];
  }

  /**
   * The initial state _before_ evaluating any microsteps.
   * This "pre-initial" state is provided to initial actions executed in the initial state.
   */
  private getPreInitialState(
    actorCtx: ActorContext<any, any> | undefined
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const [context, actions] = this.getContextAndActions(actorCtx);
    const config = getInitialConfiguration(this.root);
    const preInitial = this.resolveState(
      this.createState({
        value: {}, // TODO: this is computed in state constructor
        context,
        _event: createInitEvent({}) as unknown as SCXML.Event<TEvent>, // TODO: fix
        _sessionid: actorCtx?.sessionId ?? undefined,
        actions: [],
        meta: undefined,
        configuration: config,
        transitions: [],
        children: {}
      })
    );
    preInitial._initial = true;
    preInitial.actions.unshift(...actions);

    if (actorCtx) {
      const { nextState } = resolveActionsAndContext(
        actions,
        initEvent as SCXML.Event<TEvent>,
        preInitial,
        actorCtx
      );
      preInitial.children = nextState.children;
      preInitial.actions = nextState.actions;
    }

    return preInitial;
  }

  /**
   * The initial State instance, which includes all actions to be executed from
   * entering the initial state.
   */
  public get initialState(): State<TContext, TEvent, TResolvedTypesMeta> {
    return this.getInitialState();
  }

  /**
   * Returns the initial `State` instance, with reference to `self` as an `ActorRef`.
   */
  public getInitialState(
    actorCtx?: ActorContext<TEvent, State<TContext, TEvent, TResolvedTypesMeta>>
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const input = actorCtx?.input;
    const initEvent = createInitEvent(input) as unknown as SCXML.Event<TEvent>; // TODO: fix;

    const preInitialState = this.getPreInitialState(actorCtx);
    const nextState = microstep([], preInitialState, actorCtx, initEvent);
    nextState.actions.unshift(...preInitialState.actions);

    const { state: macroState } = macrostep(nextState, initEvent, actorCtx);

    return macroState;
  }

  public start(
    state: State<TContext, TEvent, TResolvedTypesMeta>,
    actorCtx: ActorContext<TEvent, State<TContext, TEvent, TResolvedTypesMeta>>
  ): void {
    state.actions.forEach((action) => {
      action.execute?.(actorCtx);
    });
    Object.values(state.children).forEach((child) => {
      if (child.status === 0) {
        try {
          child.start?.();
        } catch (err) {
          // TODO: unify error handling when child starts
          actorCtx.self.send(error(child.id, err) as unknown as TEvent);
        }
      }
    });
  }

  public getStateNodeById(stateId: string): StateNode<TContext, TEvent> {
    const resolvedStateId = isStateId(stateId)
      ? stateId.slice(STATE_IDENTIFIER.length)
      : stateId;

    const stateNode = this.idMap.get(resolvedStateId);
    if (!stateNode) {
      throw new Error(
        `Child state node '#${resolvedStateId}' does not exist on machine '${this.id}'`
      );
    }
    return stateNode;
  }

  public get definition(): StateMachineDefinition<TContext, TEvent> {
    return {
      context: this.getContext(),
      ...this.root.definition
    };
  }

  public toJSON() {
    return this.definition;
  }

  public getPersistedState(
    state: State<TContext, TEvent, TResolvedTypesMeta>
  ): PersistedMachineState<State<TContext, TEvent, TResolvedTypesMeta>> {
    return getPersistedState(state);
  }

  public createState(
    stateConfig:
      | State<TContext, TEvent, TResolvedTypesMeta>
      | StateConfig<TContext, TEvent>
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const state =
      stateConfig instanceof State ? stateConfig : new State(stateConfig, this);

    const { nextState: resolvedState } = resolveActionsAndContext(
      state.actions,
      state._event,
      state,
      undefined
    );

    return resolvedState as State<TContext, TEvent, TResolvedTypesMeta>;
  }

  public getStatus(state: State<TContext, TEvent, TResolvedTypesMeta>) {
    return state.done
      ? { status: 'done', data: state.output }
      : { status: 'active' };
  }

  public restoreState(
    state: PersistedMachineState<State<TContext, TEvent, TResolvedTypesMeta>>,
    _actorCtx: ActorContext<TEvent, State<TContext, TEvent, TResolvedTypesMeta>>
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const children = {};

    Object.keys(state.children).forEach((actorId) => {
      const actorData = state.children[actorId];
      const childState = actorData.state;
      const src = actorData.src;

      const behavior = src ? this.options.actors[src] : undefined;

      if (!behavior) {
        return;
      }

      const actorState = behavior.restoreState?.(childState, _actorCtx);

      const actorRef = interpret(behavior, {
        id: actorId,
        state: actorState
      });

      children[actorId] = actorRef;
    });

    const restoredState: State<TContext, TEvent, TResolvedTypesMeta> =
      this.createState(new State({ ...state, children }, this));

    // TODO: DRY this up
    restoredState.configuration.forEach((stateNode) => {
      if (stateNode.invoke) {
        stateNode.invoke.forEach((invokeConfig) => {
          const { id, src, input } = invokeConfig;

          if (children[id]) {
            return;
          }

          const behavior = this.options.actors[src];

          if (behavior) {
            const actorRef = interpret(behavior, {
              id,
              parent: _actorCtx?.self,
              input
            });

            children[id] = actorRef;
          }
        });
      }
    });

    return restoredState;
  }

  /**@deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TContext!: TContext;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TEvent!: TEvent;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TAction!: TAction;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TActorMap!: TActorMap;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TResolvedTypesMeta!: TResolvedTypesMeta;
}
