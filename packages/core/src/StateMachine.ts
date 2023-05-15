import { error, createInitEvent, initEvent } from './actions.ts';
import { STATE_DELIMITER } from './constants.ts';
import { createSpawner } from './spawn.ts';
import { getPersistedState, State } from './State.ts';
import { StateNode } from './StateNode.ts';
import { interpret } from './interpreter.ts';
import {
  getConfiguration,
  getStateNodeByPath,
  getInitialConfiguration,
  getStateNodes,
  isInFinalState,
  isStateId,
  macrostep,
  microstep,
  resolveActionsAndContext,
  resolveStateValue,
  transitionNode
} from './stateUtils.ts';
import type {
  AreAllImplementationsAssumedToBeProvided,
  MarkAllImplementationsAsProvided,
  ResolveTypegenMeta,
  TypegenDisabled
} from './typegenTypes.ts';
import type {
  ActorContext,
  ActorMap,
  ActorBehavior,
  EventObject,
  InternalMachineImplementations,
  InvokeActionObject,
  MachineConfig,
  MachineContext,
  MachineImplementationsSimplified,
  MachineTypes,
  NoInfer,
  StateConfig,
  StateMachineDefinition,
  StateValue,
  TransitionDefinition,
  PersistedMachineState,
  ParameterizedObject,
  AnyActorContext,
  AnyEventObject
} from './types.ts';
import { isErrorEvent, resolveReferencedActor } from './utils.ts';

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
  TAction extends ParameterizedObject = ParameterizedObject,
  TActorMap extends ActorMap = ActorMap,
  TResolvedTypesMeta = ResolveTypegenMeta<
    TypegenDisabled,
    NoInfer<TEvent>,
    TAction,
    TActorMap
  >
> implements
    ActorBehavior<
      TEvent,
      State<TContext, TEvent, TResolvedTypesMeta>,
      State<TContext, TEvent, TResolvedTypesMeta>,
      PersistedMachineState<State<TContext, TEvent, TResolvedTypesMeta>>
    >
{
  // TODO: this getter should be removed
  public getContext(input?: any): TContext {
    return this.getContextAndActions(undefined, input)[0];
  }
  private getContextAndActions(
    actorCtx?: ActorContext<any, any>,
    input?: any
  ): [TContext, InvokeActionObject[]] {
    const actions: InvokeActionObject[] = [];
    const { context } = this.config;
    const resolvedContext =
      typeof context === 'function'
        ? context({
            spawn: createSpawner(
              actorCtx?.self,
              this,
              undefined as any, // TODO: this requires `| undefined` for all referenced dynamic inputs that are spawnable in the context factory,
              createInitEvent(input),
              actions
            ),
            input
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

  public types: MachineTypes<TContext, TEvent>;

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
    this.types = this.config.types ?? ({} as any as this['types']);
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
    state: State<TContext, TEvent, TResolvedTypesMeta>,
    event: TEvent,
    actorCtx: ActorContext<TEvent, State<TContext, TEvent, any>>
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    // TODO: handle error events in a better way
    if (
      isErrorEvent(event) &&
      !state.nextEvents.some((nextEvent) => nextEvent === event.type)
    ) {
      throw event.data;
    }

    const { state: nextState } = macrostep(state, event, actorCtx);

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
    state: State<TContext, TEvent, TResolvedTypesMeta>,
    event: TEvent,
    actorCtx: AnyActorContext
  ): Array<State<TContext, TEvent, TResolvedTypesMeta>> {
    return macrostep(state, event, actorCtx).microstates;
  }

  public getTransitionData(
    state: State<TContext, TEvent, TResolvedTypesMeta>,
    event: TEvent
  ): Array<TransitionDefinition<TContext, TEvent>> {
    return transitionNode(this.root, state.value, state, event) || [];
  }

  /**
   * The initial state _before_ evaluating any microsteps.
   * This "pre-initial" state is provided to initial actions executed in the initial state.
   */
  private getPreInitialState(
    actorCtx: AnyActorContext,
    input: any
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const [context, actions] = this.getContextAndActions(actorCtx, input);
    const config = getInitialConfiguration(this.root);
    const preInitial = this.resolveState(
      this.createState({
        value: {}, // TODO: this is computed in state constructor
        context,
        event: createInitEvent({}) as unknown as TEvent,
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
        initEvent as TEvent,
        preInitial,
        actorCtx
      );
      preInitial.children = nextState.children;
      preInitial.actions = nextState.actions;
    }

    return preInitial;
  }

  /**
   * Returns the initial `State` instance, with reference to `self` as an `ActorRef`.
   */
  public getInitialState(
    actorCtx: ActorContext<TEvent, State<TContext, TEvent, TResolvedTypesMeta>>,
    input?: any
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const initEvent = createInitEvent(input) as unknown as TEvent; // TODO: fix;

    const preInitialState = this.getPreInitialState(actorCtx, input);
    const nextState = microstep([], preInitialState, actorCtx, initEvent);
    nextState.actions.unshift(...preInitialState.actions);

    const { state: macroState } = macrostep(
      nextState,
      initEvent as AnyEventObject,
      actorCtx
    );

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
    const fullPath = stateId.split(this.delimiter);
    const relativePath = fullPath.slice(1);
    const resolvedStateId = isStateId(fullPath[0])
      ? fullPath[0].slice(STATE_IDENTIFIER.length)
      : fullPath[0];

    const stateNode = this.idMap.get(resolvedStateId);
    if (!stateNode) {
      throw new Error(
        `Child state node '#${resolvedStateId}' does not exist on machine '${this.id}'`
      );
    }
    return getStateNodeByPath(stateNode, relativePath);
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
      state.event,
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

      const behavior = src
        ? resolveReferencedActor(this.options.actors[src])?.src
        : undefined;

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
          const { id, src } = invokeConfig;

          if (children[id]) {
            return;
          }

          const referenced = resolveReferencedActor(this.options.actors[src]);

          if (referenced) {
            const actorRef = interpret(referenced.src, {
              id,
              parent: _actorCtx?.self,
              input:
                'input' in invokeConfig ? invokeConfig.input : referenced.input
            });

            children[id] = actorRef;
          }
        });
      }
    });

    restoredState.actions = [];

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
