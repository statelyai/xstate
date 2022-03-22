import { AnyStateMachine, InvokeActionObject, Spawner, StateFrom } from '.';
import { STATE_DELIMITER } from './constants';
import { IS_PRODUCTION } from './environment';
import { createSpawner } from './spawn';
import { State } from './State';
import { StateNode } from './StateNode';
import {
  getConfiguration,
  getStateNodes,
  getStateValue,
  isStateId,
  macrostep,
  resolveMicroTransition,
  resolveStateValue,
  toState,
  transitionNode
} from './stateUtils';
import type {
  AreAllImplementationsAssumedToBeProvided,
  MarkAllImplementationsAsProvided,
  ResolveTypegenMeta,
  TypegenDisabled
} from './typegenTypes';
import type {
  ActorMap,
  BaseActionObject,
  Event,
  EventObject,
  InternalMachineImplementations,
  MachineConfig,
  MachineContext,
  MachineImplementationsSimplified,
  MachineSchema,
  MaybeLazy,
  NoInfer,
  SCXML,
  StateConfig,
  StateNodeDefinition,
  StateValue,
  Transitions
} from './types';
import { isBuiltInEvent, isFunction, toSCXMLEvent } from './utils';

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

function resolveContext<TContext extends MachineContext>(
  context: TContext,
  partialContext?: Partial<TContext>
): TContext {
  if (isFunction(partialContext)) {
    return { ...context, ...partialContext };
  }

  return {
    ...context,
    ...partialContext
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
> {
  private _contextFactory: (stuff: { spawn: Spawner }) => TContext;
  public get context(): TContext {
    return this.getContextAndActions()[0];
  }
  public getContextAndActions(): [TContext, InvokeActionObject[]] {
    const actions: InvokeActionObject[] = [];
    // TODO: merge with this.options.context
    const context = this._contextFactory({
      spawn: createSpawner(this, null as any, null as any, actions) // TODO: fix types
    });

    return [context, actions];
  }
  /**
   * The machine's own version.
   */
  public version?: string;

  public strict: boolean;

  /**
   * The string delimiter for serializing the path to a string. The default is "."
   */
  public delimiter: string;

  public options: MachineImplementationsSimplified<TContext, TEvent>;

  public schema: MachineSchema<TContext, TEvent>;

  public __xstatenode: true = true;

  public idMap: Map<string, StateNode<TContext, TEvent>> = new Map();

  public root: StateNode<TContext, TEvent>;

  public key: string;

  public states: StateNode<TContext, TEvent>['states'];
  public events: Array<TEvent['type']>;

  constructor(
    /**
     * The raw config used to create the machine.
     */
    public config: MachineConfig<TContext, TEvent, any, any, any>,
    options?: MachineImplementationsSimplified<TContext, TEvent>
  ) {
    this.key = config.key || config.id || '(machine)';
    this.options = Object.assign(createDefaultOptions(), options);
    this._contextFactory = isFunction(config.context)
      ? config.context
      : (stuff) => {
          const partialContext =
            typeof options?.context === 'function'
              ? options.context(stuff)
              : options?.context;

          return resolveContext(
            config.context as TContext,
            partialContext
          ) as TContext;
        }; // TODO: fix types
    // this.context = resolveContext(config.context, options?.context);
    this.delimiter = this.config.delimiter || STATE_DELIMITER;
    this.version = this.config.version;
    this.schema = this.config.schema ?? (({} as any) as this['schema']);
    this.strict = !!this.config.strict;
    this.transition = this.transition.bind(this);

    this.root = new StateNode(config, {
      _key: this.key,
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
    > & { context?: MaybeLazy<Partial<TContext>> }
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
      delays: { ...delays, ...implementations.delays },
      context: implementations.context!
    });
  }

  /**
   * Clones this state machine with custom `context`.
   *
   * The `context` provided can be partial `context`, which will be combined with the original `context`.
   *
   * @param context Custom context (will override predefined context, not recursive)
   */
  public withContext(context: Partial<TContext>): this;
  public withContext(context: Partial<TContext>): AnyStateMachine {
    return this.provide({
      context
    } as any);
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
    const configuration = Array.from(
      getConfiguration(getStateNodes(this.root, state.value))
    );
    return this.createState({
      ...state,
      value: resolveStateValue(this.root, state.value),
      configuration
    });
  }

  /**
   * Determines the next state given the current `state` and received `event`.
   * Calculates a full macrostep from all microsteps.
   *
   * @param state The current State instance or state value
   * @param event The received event
   */
  public transition(
    state: StateValue | State<TContext, TEvent, TResolvedTypesMeta> = this
      .initialState,
    event: Event<TEvent> | SCXML.Event<TEvent>
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const currentState = toState(state, this);

    return macrostep(currentState, event, this);
  }

  /**
   * Determines the next state given the current `state` and `event`.
   * Calculates a microstep.
   *
   * @param state The current state
   * @param event The received event
   */
  public microstep(
    state: StateValue | State<TContext, TEvent, TResolvedTypesMeta> = this
      .initialState,
    event: Event<TEvent> | SCXML.Event<TEvent>
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const resolvedState = toState(state, this);
    const _event = toSCXMLEvent(event);

    if (!IS_PRODUCTION && _event.name === WILDCARD) {
      throw new Error(`An event cannot have the wildcard type ('${WILDCARD}')`);
    }

    if (this.strict) {
      if (
        !this.root.events.includes(_event.name) &&
        !isBuiltInEvent(_event.name)
      ) {
        throw new Error(
          `Machine '${this.key}' does not accept event '${_event.name}'`
        );
      }
    }

    const transitions = this.getTransitionData(resolvedState, _event);

    return resolveMicroTransition(this, transitions, resolvedState, _event);
  }

  public getTransitionData(
    state: State<TContext, TEvent, TResolvedTypesMeta>,
    _event: SCXML.Event<TEvent>
  ): Transitions<TContext, TEvent> {
    return transitionNode(this.root, state.value, state, _event) || [];
  }

  /**
   * The initial state _before_ evaluating any microsteps.
   */
  private get preInitialState(): State<TContext, TEvent, TResolvedTypesMeta> {
    const [context, actions] = this.getContextAndActions();
    const preInitial = this.resolveState(
      State.from(
        getStateValue(this.root, getConfiguration([this.root])),
        context
      )
    );
    preInitial._initial = true;
    preInitial.actions.unshift(...actions);

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
  public getInitialState(): StateFrom<typeof this> {
    const { preInitialState } = this;
    const nextState = resolveMicroTransition(
      this,
      [],
      preInitialState,
      undefined
    );
    nextState.actions.unshift(...preInitialState.actions);
    return macrostep(nextState, null as any, this) as StateFrom<typeof this>;
  }

  public getStateNodeById(stateId: string): StateNode<TContext, TEvent> {
    const resolvedStateId = isStateId(stateId)
      ? stateId.slice(STATE_IDENTIFIER.length)
      : stateId;

    const stateNode = this.idMap.get(resolvedStateId);
    if (!stateNode) {
      throw new Error(
        `Child state node '#${resolvedStateId}' does not exist on machine '${this.key}'`
      );
    }
    return stateNode;
  }

  public get definition(): StateNodeDefinition<TContext, TEvent> {
    return this.root.definition;
  }

  public toJSON() {
    return this.definition;
  }

  public createState(
    stateConfig:
      | State<TContext, TEvent, TResolvedTypesMeta>
      | StateConfig<TContext, TEvent>
  ): State<TContext, TEvent, TResolvedTypesMeta> {
    const state =
      stateConfig instanceof State
        ? stateConfig
        : (new State(stateConfig) as State<
            TContext,
            TEvent,
            TResolvedTypesMeta
          >);
    state.machine = this;
    return state;
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
