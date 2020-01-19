import {
  getEventType,
  toStateValue,
  mapValues,
  path,
  pathToStateValue,
  flatten,
  mapFilterValues,
  toArray,
  keys,
  isBuiltInEvent,
  isString,
  toSCXMLEvent,
  toInvokeConfig
} from './utils';
import {
  Event,
  StateValue,
  StateTransition,
  MachineOptions,
  EventObject,
  HistoryStateNodeConfig,
  StateNodeDefinition,
  TransitionDefinition,
  DelayedTransitionDefinition,
  StateNodeConfig,
  StateSchema,
  StatesDefinition,
  StateNodesConfig,
  FinalStateNodeConfig,
  InvokeDefinition,
  ActionObject,
  Mapper,
  PropertyMapper,
  NullEvent,
  MachineConfig,
  SCXML,
  Typestate,
  TransitionDefinitionMap,
  ActivityDefinition
} from './types';
import { matchesState } from './utils';
import { State } from './State';
import * as actionTypes from './actionTypes';
import { toActionObject, toActivityDefinition } from './actions';
import { IS_PRODUCTION } from './environment';
import { STATE_DELIMITER } from './constants';
import {
  getConfiguration,
  getChildren,
  getAllStateNodes,
  isLeafNode
} from './stateUtils';
import {
  getDelayedTransitions,
  formatTransitions,
  getCandidates,
  getStateNodeById,
  getRelativeStateNodes,
  getInitialState,
  getStateNodes,
  nodesFromChild,
  evaluateGuard,
  isStateId,
  transitionNode,
  resolveStateValue,
  resolveTransition
} from './nodeUtils';

export const NULL_EVENT = '';
export const STATE_IDENTIFIER = '#';
export const WILDCARD = '*';

const EMPTY_OBJECT = {};

const createDefaultOptions = <TContext>(): MachineOptions<TContext, any> => ({
  actions: {},
  guards: {},
  services: {},
  activities: {},
  delays: {}
});

export class StateNode<
  TContext = any,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = EventObject,
  TTypestate extends Typestate<TContext> = any
> {
  /**
   * The relative key of the state node, which represents its location in the overall state value.
   */
  public key: string;
  /**
   * The unique ID of the state node.
   */
  public id: string;
  /**
   * The machine's own version.
   */
  public version?: string;
  /**
   * The type of this state node:
   *
   *  - `'atomic'` - no child state nodes
   *  - `'compound'` - nested child state nodes (XOR)
   *  - `'parallel'` - orthogonal nested child state nodes (AND)
   *  - `'history'` - history state node
   *  - `'final'` - final state node
   */
  public type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  /**
   * The string path from the root machine node to this node.
   */
  public path: string[];
  /**
   * The initial state node key.
   */
  public initial?: keyof TStateSchema['states'];
  /**
   * Whether the state node is "transient". A state node is considered transient if it has
   * an immediate transition from a "null event" (empty string), taken upon entering the state node.
   */
  public _transient: boolean;
  /**
   * The child state nodes.
   */
  public states: StateNodesConfig<TContext, TStateSchema, TEvent>;
  /**
   * The type of history on this state node. Can be:
   *
   *  - `'shallow'` - recalls only top-level historical state value
   *  - `'deep'` - recalls historical state value at all levels
   */
  public history: false | 'shallow' | 'deep';
  /**
   * The action(s) to be executed upon entering the state node.
   */
  public entry: Array<ActionObject<TContext, TEvent>>;
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  public exit: Array<ActionObject<TContext, TEvent>>;
  public strict: boolean;
  /**
   * The parent state node.
   */
  public parent?: StateNode<TContext, any, TEvent>;
  /**
   * The root machine node.
   */
  public machine: StateNode<TContext, any, TEvent>;
  /**
   * The meta data associated with this state node, which will be returned in State instances.
   */
  public meta?: TStateSchema extends { meta: infer D } ? D : any;
  /**
   * The data sent with the "done.state._id_" event if this is a final state node.
   */
  public data?: Mapper<TContext, TEvent> | PropertyMapper<TContext, TEvent>;
  /**
   * The string delimiter for serializing the path to a string. The default is "."
   */
  public delimiter: string;
  /**
   * The order this state node appears. Corresponds to the implicit SCXML document order.
   */
  public order: number = -1;
  /**
   * The services invoked by this state node.
   */
  public invoke: Array<InvokeDefinition<TContext, TEvent>>;

  public options: MachineOptions<TContext, TEvent>;
  public activities: Array<ActivityDefinition<TContext, TEvent>>;

  public __xstatenode: true = true;

  public __cache = {
    events: undefined as Array<TEvent['type']> | undefined,
    relativeValue: new Map() as Map<StateNode<TContext>, StateValue>,
    initialStateValue: undefined as StateValue | undefined,
    initialState: undefined as State<TContext, TEvent> | undefined,
    on: undefined as TransitionDefinitionMap<TContext, TEvent> | undefined,
    transitions: undefined as
      | Array<TransitionDefinition<TContext, TEvent>>
      | undefined,
    candidates: {} as {
      [K in TEvent['type'] | NullEvent['type'] | '*']:
        | Array<
            TransitionDefinition<
              TContext,
              K extends TEvent['type']
                ? Extract<TEvent, { type: K }>
                : EventObject
            >
          >
        | undefined;
    },
    delayedTransitions: undefined as
      | Array<DelayedTransitionDefinition<TContext, TEvent>>
      | undefined
  };

  public idMap: Record<string, StateNode<TContext, any, TEvent>> = {};

  constructor(
    /**
     * The raw config used to create the machine.
     */
    public config: StateNodeConfig<TContext, TStateSchema, TEvent>,
    options?: Partial<MachineOptions<TContext, TEvent>>,
    /**
     * The initial extended state
     */
    public context?: Readonly<TContext>
  ) {
    this.options = Object.assign(createDefaultOptions<TContext>(), options);
    this.parent = this.options._parent;
    this.key =
      this.config.key || this.options._key || this.config.id || '(machine)';
    this.machine = this.parent ? this.parent.machine : this;
    this.path = this.parent ? this.parent.path.concat(this.key) : [];
    this.delimiter =
      this.config.delimiter ||
      (this.parent ? this.parent.delimiter : STATE_DELIMITER);
    this.id =
      this.config.id || [this.machine.key, ...this.path].join(this.delimiter);
    this.version = this.parent
      ? this.parent.version
      : (this.config as MachineConfig<TContext, TStateSchema, TEvent>).version;
    this.type =
      this.config.type ||
      (this.config.states && keys(this.config.states).length
        ? 'compound'
        : this.config.history
        ? 'history'
        : 'atomic');

    this.initial = this.config.initial;

    this.states = (this.config.states
      ? mapValues(
          this.config.states,
          (stateConfig: StateNodeConfig<TContext, any, TEvent>, key) => {
            const stateNode = new StateNode(stateConfig, {
              _parent: this,
              _key: key
            });
            Object.assign(this.idMap, {
              [stateNode.id]: stateNode,
              ...stateNode.idMap
            });
            return stateNode;
          }
        )
      : EMPTY_OBJECT) as StateNodesConfig<TContext, TStateSchema, TEvent>;

    // Document order
    let order = 0;

    function dfs(stateNode: StateNode<TContext, any, TEvent>): void {
      stateNode.order = order++;

      for (const child of getChildren(stateNode)) {
        dfs(child);
      }
    }

    dfs(this);

    // History config
    this.history =
      this.config.history === true ? 'shallow' : this.config.history || false;

    this._transient = !this.config.on
      ? false
      : Array.isArray(this.config.on)
      ? this.config.on.some(({ event }: { event: string }) => {
          return event === NULL_EVENT;
        })
      : NULL_EVENT in this.config.on;
    this.strict = !!this.config.strict;

    this.entry = toArray(this.config.entry).map(action =>
      toActionObject(action)
    );

    this.exit = toArray(this.config.exit).map(action => toActionObject(action));
    this.meta = this.config.meta;
    this.data =
      this.type === 'final'
        ? (this.config as FinalStateNodeConfig<TContext, TEvent>).data
        : undefined;
    this.invoke = toArray(this.config.invoke).map((invocable, i) => {
      const id = `${this.id}:invocation[${i}]`;

      const invokeConfig = toInvokeConfig(invocable, id);
      const resolvedId = invokeConfig.id || id;

      const resolvedSrc = isString(invokeConfig.src)
        ? invokeConfig.src
        : resolvedId;

      if (
        !this.machine.options.services[resolvedSrc] &&
        !isString(invokeConfig.src)
      ) {
        this.machine.options.services = {
          ...this.machine.options.services,
          [resolvedSrc]: invokeConfig.src as any
        };
      }

      return {
        type: actionTypes.invoke,
        ...invokeConfig,
        src: resolvedSrc,
        id: resolvedId
      };
    });

    this.activities = toArray(this.invoke).map(toActivityDefinition);
    this.transition = this.transition.bind(this);
  }

  private _init(): void {
    if (this.__cache.transitions) {
      return;
    }
    getAllStateNodes(this).forEach(stateNode => stateNode.on);
  }

  /**
   * Clones this state machine with custom options and context.
   *
   * @param options Options (actions, guards, activities, services) to recursively merge with the existing options.
   * @param context Custom context (will override predefined context)
   */
  public withConfig(
    options: Partial<MachineOptions<TContext, TEvent>>,
    context: TContext | undefined = this.context
  ): StateNode<TContext, TStateSchema, TEvent> {
    const { actions, activities, guards, services, delays } = this.options;

    return new StateNode(
      this.config,
      {
        actions: { ...actions, ...options.actions },
        activities: { ...activities, ...options.activities },
        guards: { ...guards, ...options.guards },
        services: { ...services, ...options.services },
        delays: { ...delays, ...options.delays }
      },
      context
    );
  }

  /**
   * Clones this state machine with custom context.
   *
   * @param context Custom context (will override predefined context, not recursive)
   */
  public withContext(
    context: TContext
  ): StateNode<TContext, TStateSchema, TEvent> {
    return new StateNode(this.config, this.options, context);
  }

  /**
   * The well-structured state node definition.
   */
  public get definition(): StateNodeDefinition<TContext, TStateSchema, TEvent> {
    return {
      id: this.id,
      key: this.key,
      version: this.version,
      type: this.type,
      initial: this.initial,
      history: this.history,
      states: mapValues(
        this.states,
        (state: StateNode<TContext, any, TEvent>) => state.definition
      ) as StatesDefinition<TContext, TStateSchema, TEvent>,
      on: this.on,
      transitions: this.transitions,
      entry: this.entry,
      exit: this.exit,
      meta: this.meta,
      order: this.order || -1,
      data: this.data,
      invoke: this.invoke
    };
  }

  public toJSON() {
    return this.definition;
  }

  /**
   * The mapping of events to transitions.
   */
  public get on(): TransitionDefinitionMap<TContext, TEvent> {
    if (this.__cache.on) {
      return this.__cache.on;
    }

    const transitions = this.transitions;

    return (this.__cache.on = transitions.reduce(
      (map, transition) => {
        map[transition.eventType] = map[transition.eventType] || [];
        map[transition.eventType].push(transition as any);
        return map;
      },
      {} as TransitionDefinitionMap<TContext, TEvent>
    ));
  }

  public get after(): Array<DelayedTransitionDefinition<TContext, TEvent>> {
    return (
      this.__cache.delayedTransitions ||
      ((this.__cache.delayedTransitions = getDelayedTransitions(this)),
      this.__cache.delayedTransitions)
    );
  }

  /**
   * All the transitions that can be taken from this state node.
   */
  public get transitions(): Array<TransitionDefinition<TContext, TEvent>> {
    return (
      this.__cache.transitions ||
      ((this.__cache.transitions = formatTransitions(this)),
      this.__cache.transitions)
    );
  }

  /**
   * Returns `true` if this state node explicitly handles the given event.
   *
   * @param event The event in question
   */
  public handles(event: Event<TEvent>): boolean {
    const eventType = getEventType<TEvent>(event);

    return this.events.includes(eventType);
  }

  /**
   * Resolves the given `state` to a new `State` instance relative to this machine.
   *
   * This ensures that `.events` and `.nextEvents` represent the correct values.
   *
   * @param state The state to resolve
   */
  public resolveState(state: State<TContext, TEvent>): State<TContext, TEvent> {
    const configuration = Array.from(
      getConfiguration([], getStateNodes(this, state.value))
    );
    return new State({
      ...state,
      value: resolveStateValue(this, state.value),
      configuration
    });
  }

  public next(
    state: State<TContext, TEvent>,
    _event: SCXML.Event<TEvent>
  ): StateTransition<TContext, TEvent> | undefined {
    const eventName = _event.name;
    const actions: Array<ActionObject<TContext, TEvent>> = [];

    let nextStateNodes: Array<StateNode<TContext, any, TEvent>> = [];
    let selectedTransition: TransitionDefinition<TContext, TEvent> | undefined;

    for (const candidate of getCandidates(this, eventName)) {
      const { cond, in: stateIn } = candidate;
      const resolvedContext = state.context;

      const isInState = stateIn
        ? isString(stateIn) && isStateId(stateIn)
          ? // Check if in state by ID
            state.matches(
              toStateValue(getStateNodeById(this, stateIn).path, this.delimiter)
            )
          : // Check if in state by relative grandparent
            matchesState(
              toStateValue(stateIn, this.delimiter),
              path(this.path.slice(0, -2))(state.value)
            )
        : true;

      let guardPassed = false;

      try {
        guardPassed =
          !cond || evaluateGuard(this, cond, resolvedContext, _event, state);
      } catch (err) {
        throw new Error(
          `Unable to evaluate guard '${cond!.name ||
            cond!
              .type}' in transition for event '${eventName}' in state node '${
            this.id
          }':\n${err.message}`
        );
      }

      if (guardPassed && isInState) {
        if (candidate.target !== undefined) {
          nextStateNodes = candidate.target;
        }
        actions.push(...candidate.actions);
        selectedTransition = candidate;
        break;
      }
    }

    if (!selectedTransition) {
      return undefined;
    }
    if (!nextStateNodes.length) {
      return {
        transitions: [selectedTransition],
        entrySet: [],
        exitSet: [],
        configuration: state.value ? [this] : [],
        source: state,
        actions
      };
    }

    const allNextStateNodes = flatten(
      nextStateNodes.map(stateNode => {
        return getRelativeStateNodes(stateNode, state.historyValue);
      })
    );

    const isInternal = !!selectedTransition.internal;

    const reentryNodes = isInternal
      ? []
      : flatten(
          allNextStateNodes.map(nextStateNode =>
            nodesFromChild(this, nextStateNode)
          )
        );

    return {
      transitions: [selectedTransition],
      entrySet: reentryNodes,
      exitSet: isInternal ? [] : [this],
      configuration: allNextStateNodes,
      source: state,
      actions
    };
  }

  /**
   * Determines the next state given the current `state` and sent `event`.
   *
   * @param state The current State instance or state value
   * @param event The event that was sent at the current state
   * @param context The current context (extended state) of the current state
   */
  public transition(
    state: StateValue | State<TContext, TEvent> = this.initialState,
    event: Event<TEvent> | SCXML.Event<TEvent>
  ): State<TContext, TEvent, TStateSchema, TTypestate> {
    const _event = toSCXMLEvent(event);
    let currentState: State<TContext, TEvent>;

    if (state instanceof State) {
      currentState = state;
    } else {
      const resolvedStateValue = resolveStateValue(this, state);
      const resolvedContext = this.machine.context!;

      currentState = this.resolveState(
        State.from<TContext, TEvent>(resolvedStateValue, resolvedContext)
      );
    }

    if (!IS_PRODUCTION && _event.name === WILDCARD) {
      throw new Error(`An event cannot have the wildcard type ('${WILDCARD}')`);
    }

    if (this.strict) {
      if (!this.events.includes(_event.name) && !isBuiltInEvent(_event.name)) {
        throw new Error(
          `Machine '${this.id}' does not accept event '${_event.name}'`
        );
      }
    }

    const stateTransition = transitionNode(
      this,
      currentState.value,
      currentState,
      _event
    ) || {
      transitions: [],
      configuration: [],
      entrySet: [],
      exitSet: [],
      source: currentState,
      actions: []
    };

    const prevConfig = getConfiguration(
      [],
      getStateNodes(this, currentState.value)
    );
    const resolvedConfig = stateTransition.configuration.length
      ? getConfiguration(prevConfig, stateTransition.configuration)
      : prevConfig;

    stateTransition.configuration = [...resolvedConfig];

    return resolveTransition(this, stateTransition, currentState, _event);
  }

  public get initialStateValue(): StateValue | undefined {
    if (this.__cache.initialStateValue) {
      return this.__cache.initialStateValue;
    }

    let initialStateValue: StateValue | undefined;

    if (this.type === 'parallel') {
      initialStateValue = mapFilterValues(
        this.states as Record<string, StateNode<TContext, any, TEvent>>,
        state => state.initialStateValue || EMPTY_OBJECT,
        stateNode => !(stateNode.type === 'history')
      );
    } else if (this.initial !== undefined) {
      if (!this.states[this.initial]) {
        throw new Error(
          `Initial state '${this.initial}' not found on '${this.key}'`
        );
      }

      initialStateValue = (isLeafNode(this.states[this.initial])
        ? this.initial
        : {
            [this.initial]: this.states[this.initial].initialStateValue
          }) as StateValue;
    }

    this.__cache.initialStateValue = initialStateValue;

    return this.__cache.initialStateValue;
  }

  /**
   * The initial State instance, which includes all actions to be executed from
   * entering the initial state.
   */
  public get initialState(): State<TContext, TEvent, TStateSchema, TTypestate> {
    this._init();
    const { initialStateValue } = this;

    if (!initialStateValue) {
      throw new Error(
        `Cannot retrieve initial state from simple state '${this.id}'.`
      );
    }

    return getInitialState(this, initialStateValue);
  }

  /**
   * The target state value of the history state node, if it exists. This represents the
   * default state value to transition to if no history value exists yet.
   */
  public get target(): StateValue | undefined {
    let target;
    if (this.type === 'history') {
      const historyConfig = this.config as HistoryStateNodeConfig<
        TContext,
        TEvent
      >;
      if (isString(historyConfig.target)) {
        target = isStateId(historyConfig.target)
          ? pathToStateValue(
              getStateNodeById(this.machine, historyConfig.target).path.slice(
                this.path.length - 1
              )
            )
          : historyConfig.target;
      } else {
        target = historyConfig.target;
      }
    }

    return target;
  }

  /**
   * All the state node IDs of this state node and its descendant state nodes.
   */
  public get stateIds(): string[] {
    const childStateIds = flatten(
      keys(this.states).map(stateKey => {
        return this.states[stateKey].stateIds;
      })
    );
    return [this.id].concat(childStateIds);
  }

  /**
   * All the event types accepted by this state node and its descendants.
   */
  public get events(): Array<TEvent['type']> {
    if (this.__cache.events) {
      return this.__cache.events;
    }
    const { states } = this;
    const events = new Set(this.ownEvents);

    if (states) {
      for (const stateId of keys(states)) {
        const state = states[stateId];
        if (state.states) {
          for (const event of state.events) {
            events.add(`${event}`);
          }
        }
      }
    }

    return (this.__cache.events = Array.from(events));
  }

  /**
   * All the events that have transitions directly from this state node.
   *
   * Excludes any inert events.
   */
  public get ownEvents(): Array<TEvent['type']> {
    const events = new Set(
      this.transitions
        .filter(transition => {
          return !(
            !transition.target &&
            !transition.actions.length &&
            transition.internal
          );
        })
        .map(transition => transition.eventType)
    );

    return Array.from(events);
  }

  public getStateNodeById(id: string): StateNode<TContext, any, TEvent> {
    return getStateNodeById(this, id);
  }
}
