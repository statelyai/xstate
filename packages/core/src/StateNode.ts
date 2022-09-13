import {
  getEventType,
  toStatePath,
  toStateValue,
  mapValues,
  path,
  toStatePaths,
  pathToStateValue,
  flatten,
  mapFilterValues,
  nestedPath,
  toArray,
  isBuiltInEvent,
  partition,
  updateHistoryValue,
  warn,
  isArray,
  isFunction,
  isString,
  toGuard,
  isMachine,
  toSCXMLEvent,
  mapContext,
  toTransitionConfigArray,
  normalizeTarget,
  evaluateGuard,
  createInvokeId
} from './utils';
import {
  Event,
  StateValue,
  TransitionConfig,
  StateTransition,
  StateValueMap,
  MachineOptions,
  EventObject,
  HistoryStateNodeConfig,
  HistoryValue,
  StateNodeDefinition,
  TransitionDefinition,
  DelayedTransitionDefinition,
  ActivityDefinition,
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
  InvokeCreator,
  DoneEventObject,
  SingleOrArray,
  SendActionObject,
  SpecialTargets,
  SCXML,
  RaiseActionObject,
  ActivityActionObject,
  InvokeActionObject,
  Typestate,
  TransitionDefinitionMap,
  DelayExpr,
  InvokeSourceDefinition,
  MachineSchema,
  ActorRef,
  InternalMachineOptions,
  ServiceMap,
  StateConfig,
  AnyStateMachine,
  PredictableActionArgumentsExec
} from './types';
import { matchesState } from './utils';
import { State, stateValuesEqual } from './State';
import * as actionTypes from './actionTypes';
import {
  start,
  stop,
  toActivityDefinition,
  send,
  cancel,
  after,
  raise,
  done,
  doneInvoke,
  error,
  toActionObject,
  initEvent,
  toActionObjects,
  resolveActions
} from './actions';
import { IS_PRODUCTION } from './environment';
import { STATE_DELIMITER } from './constants';
import {
  getValue,
  getConfiguration,
  has,
  getChildren,
  getAllChildren,
  getAllStateNodes,
  isInFinalState,
  isLeafNode,
  getTagsFromConfiguration
} from './stateUtils';
import { createInvocableActor } from './Actor';
import { toInvokeDefinition } from './invokeUtils';
import { TypegenDisabled } from './typegenTypes';

const NULL_EVENT = '';
const STATE_IDENTIFIER = '#';
const WILDCARD = '*';

const EMPTY_OBJECT = {};

const isStateId = (str: string) => str[0] === STATE_IDENTIFIER;
const createDefaultOptions = <TContext>(): MachineOptions<TContext, any> => ({
  actions: {},
  guards: {},
  services: {},
  activities: {},
  delays: {}
});

const validateArrayifiedTransitions = <TContext>(
  stateNode: StateNode<any, any, any, any, any, any>,
  event: string,
  transitions: Array<
    TransitionConfig<TContext, EventObject> & {
      event: string;
    }
  >
) => {
  const hasNonLastUnguardedTarget = transitions
    .slice(0, -1)
    .some(
      (transition) =>
        !('cond' in transition) &&
        !('in' in transition) &&
        (isString(transition.target) || isMachine(transition.target))
    );
  const eventText =
    event === NULL_EVENT ? 'the transient event' : `event '${event}'`;

  warn(
    !hasNonLastUnguardedTarget,
    `One or more transitions for ${eventText} on state '${stateNode.id}' are unreachable. ` +
      `Make sure that the default transition is the last one defined.`
  );
};

class StateNode<
  TContext = any,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TServiceMap extends ServiceMap = ServiceMap,
  TResolvedTypesMeta = TypegenDisabled
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
   * (DEPRECATED) Whether the state node is a parallel state node.
   *
   * Use `type: 'parallel'` instead.
   */
  public parallel?: boolean;
  /**
   * Whether the state node is "transient". A state node is considered transient if it has
   * an immediate transition from a "null event" (empty string), taken upon entering the state node.
   */
  private _transient: boolean;
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
  public onEntry: Array<ActionObject<TContext, TEvent>>; // TODO: deprecate (entry)
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  public onExit: Array<ActionObject<TContext, TEvent>>; // TODO: deprecate (exit)
  /**
   * The activities to be started upon entering the state node,
   * and stopped upon exiting the state node.
   */
  public activities: Array<ActivityDefinition<TContext, TEvent>>;
  public strict: boolean;
  /**
   * The parent state node.
   */
  public parent?: StateNode<TContext, any, TEvent, any, any, any>;
  /**
   * The root machine node.
   */
  public machine: StateNode<TContext, any, TEvent, TTypestate>;
  /**
   * The meta data associated with this state node, which will be returned in State instances.
   */
  public meta?: TStateSchema extends { meta: infer D } ? D : any;
  /**
   * The data sent with the "done.state._id_" event if this is a final state node.
   */
  public doneData?:
    | Mapper<TContext, TEvent, any>
    | PropertyMapper<TContext, TEvent, any>;
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

  public schema: MachineSchema<TContext, TEvent>;

  public __xstatenode: true = true;

  public description?: string;

  private __cache = {
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

  private idMap: Record<
    string,
    StateNode<TContext, any, TEvent, any, any, any>
  > = {};
  public tags: string[] = [];

  constructor(
    /**
     * The raw config used to create the machine.
     */
    public config: StateNodeConfig<TContext, TStateSchema, TEvent>,
    options?: MachineOptions<TContext, TEvent>,
    /**
     * The initial extended state
     */
    private _context:
      | Readonly<TContext>
      | (() => Readonly<TContext>) = ('context' in config
      ? (config as any).context
      : undefined) as any, // TODO: this is unsafe, but we're removing it in v5 anyway
    _stateInfo?: {
      parent: StateNode<any, any, any, any, any, any>;
      key: string;
    }
  ) {
    this.options = Object.assign(createDefaultOptions<TContext>(), options);
    this.parent = _stateInfo?.parent;
    this.key =
      this.config.key || _stateInfo?.key || this.config.id || '(machine)';
    this.machine = this.parent ? this.parent.machine : (this as any);
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
      (this.config.parallel
        ? 'parallel'
        : this.config.states && Object.keys(this.config.states).length
        ? 'compound'
        : this.config.history
        ? 'history'
        : 'atomic');
    this.schema = this.parent
      ? this.machine.schema
      : (this.config as MachineConfig<TContext, TStateSchema, TEvent>).schema ??
        ({} as this['schema']);
    this.description = this.config.description;

    if (!IS_PRODUCTION) {
      warn(
        !('parallel' in this.config),
        `The "parallel" property is deprecated and will be removed in version 4.1. ${
          this.config.parallel
            ? `Replace with \`type: 'parallel'\``
            : `Use \`type: '${this.type}'\``
        } in the config for state node '${this.id}' instead.`
      );
    }

    this.initial = this.config.initial;

    this.states = (this.config.states
      ? mapValues(
          this.config.states,
          (stateConfig: StateNodeConfig<TContext, any, TEvent>, key) => {
            const stateNode = new StateNode(stateConfig, {}, undefined, {
              parent: this,
              key: key as string
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

    function dfs(
      stateNode: StateNode<TContext, any, TEvent, any, any, any>
    ): void {
      stateNode.order = order++;

      for (const child of getAllChildren(stateNode)) {
        dfs(child);
      }
    }

    dfs(this);

    // History config
    this.history =
      this.config.history === true ? 'shallow' : this.config.history || false;

    this._transient =
      !!this.config.always ||
      (!this.config.on
        ? false
        : Array.isArray(this.config.on)
        ? this.config.on.some(({ event }: { event: string }) => {
            return event === NULL_EVENT;
          })
        : NULL_EVENT in this.config.on);
    this.strict = !!this.config.strict;

    // TODO: deprecate (entry)
    this.onEntry = toArray(
      this.config.entry || this.config.onEntry
    ).map((action) => toActionObject(action));
    // TODO: deprecate (exit)
    this.onExit = toArray(
      this.config.exit || this.config.onExit
    ).map((action) => toActionObject(action));
    this.meta = this.config.meta;
    this.doneData =
      this.type === 'final'
        ? (this.config as FinalStateNodeConfig<TContext, TEvent>).data
        : undefined;
    this.invoke = toArray(this.config.invoke).map((invokeConfig, i) => {
      if (isMachine(invokeConfig)) {
        const invokeId = createInvokeId(this.id, i);
        this.machine.options.services = {
          [invokeId]: invokeConfig,
          ...this.machine.options.services
        };

        return toInvokeDefinition({
          src: invokeId,
          id: invokeId
        });
      } else if (isString(invokeConfig.src)) {
        const invokeId = invokeConfig.id || createInvokeId(this.id, i);
        return toInvokeDefinition({
          ...invokeConfig,
          id: invokeId,
          src: invokeConfig.src as string
        });
      } else if (isMachine(invokeConfig.src) || isFunction(invokeConfig.src)) {
        const invokeId = invokeConfig.id || createInvokeId(this.id, i);
        this.machine.options.services = {
          [invokeId]: invokeConfig.src as InvokeCreator<TContext, TEvent>,
          ...this.machine.options.services
        } as any;

        return toInvokeDefinition({
          id: invokeId,
          ...invokeConfig,
          src: invokeId
        });
      } else {
        const invokeSource = invokeConfig.src as InvokeSourceDefinition;

        return toInvokeDefinition({
          id: createInvokeId(this.id, i),
          ...invokeConfig,
          src: invokeSource
        });
      }
    });
    this.activities = toArray(this.config.activities)
      .concat(this.invoke)
      .map((activity) => toActivityDefinition(activity));
    this.transition = this.transition.bind(this);
    this.tags = toArray(this.config.tags);

    // TODO: this is the real fix for initialization once
    // state node getters are deprecated
    // if (!this.parent) {
    //   this._init();
    // }
  }

  private _init(): void {
    if (this.__cache.transitions) {
      return;
    }
    getAllStateNodes(this).forEach((stateNode) => stateNode.on);
  }

  /**
   * Clones this state machine with custom options and context.
   *
   * @param options Options (actions, guards, activities, services) to recursively merge with the existing options.
   * @param context Custom context (will override predefined context)
   */
  public withConfig(
    options: InternalMachineOptions<TContext, TEvent, TResolvedTypesMeta, true>,
    context?: TContext | (() => TContext)
  ): StateNode<
    TContext,
    TStateSchema,
    TEvent,
    TTypestate,
    TServiceMap,
    TResolvedTypesMeta
  > {
    const { actions, activities, guards, services, delays } = this.options;

    return new StateNode(
      this.config,
      {
        actions: { ...actions, ...options.actions },
        activities: { ...activities, ...(options as any).activities },
        guards: { ...guards, ...options.guards },
        services: { ...services, ...options.services },
        delays: { ...delays, ...options.delays }
      },
      context ?? this.context
    );
  }

  /**
   * Clones this state machine with custom context.
   *
   * @param context Custom context (will override predefined context, not recursive)
   */
  public withContext(
    context: TContext | (() => TContext)
  ): StateNode<TContext, TStateSchema, TEvent, TTypestate> {
    return new StateNode(this.config, this.options, context);
  }

  public get context(): TContext {
    return isFunction(this._context) ? this._context() : this._context;
  }

  /**
   * The well-structured state node definition.
   */
  public get definition(): StateNodeDefinition<TContext, TStateSchema, TEvent> {
    return {
      id: this.id,
      key: this.key,
      version: this.version,
      context: this.context,
      type: this.type,
      initial: this.initial,
      history: this.history,
      states: mapValues(
        this.states,
        (state: StateNode<TContext, any, TEvent>) => state.definition
      ) as StatesDefinition<TContext, TStateSchema, TEvent>,
      on: this.on,
      transitions: this.transitions,
      entry: this.onEntry,
      exit: this.onExit,
      activities: this.activities || [],
      meta: this.meta,
      order: this.order || -1,
      data: this.doneData,
      invoke: this.invoke,
      description: this.description,
      tags: this.tags
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

    return (this.__cache.on = transitions.reduce((map, transition) => {
      map[transition.eventType] = map[transition.eventType] || [];
      map[transition.eventType].push(transition as any);
      return map;
    }, {} as TransitionDefinitionMap<TContext, TEvent>));
  }

  public get after(): Array<DelayedTransitionDefinition<TContext, TEvent>> {
    return (
      this.__cache.delayedTransitions ||
      ((this.__cache.delayedTransitions = this.getDelayedTransitions()),
      this.__cache.delayedTransitions)
    );
  }

  /**
   * All the transitions that can be taken from this state node.
   */
  public get transitions(): Array<TransitionDefinition<TContext, TEvent>> {
    return (
      this.__cache.transitions ||
      ((this.__cache.transitions = this.formatTransitions()),
      this.__cache.transitions)
    );
  }

  private getCandidates(eventName: TEvent['type'] | NullEvent['type'] | '*') {
    if (this.__cache.candidates[eventName]) {
      return this.__cache.candidates[eventName];
    }

    const transient = eventName === NULL_EVENT;

    const candidates = this.transitions.filter((transition) => {
      const sameEventType = transition.eventType === eventName;
      // null events should only match against eventless transitions
      return transient
        ? sameEventType
        : sameEventType || transition.eventType === WILDCARD;
    }) as any;
    this.__cache.candidates[eventName] = candidates;
    return candidates;
  }

  /**
   * All delayed transitions from the config.
   */
  private getDelayedTransitions(): Array<
    DelayedTransitionDefinition<TContext, TEvent>
  > {
    const afterConfig = this.config.after;

    if (!afterConfig) {
      return [];
    }

    const mutateEntryExit = (
      delay: string | number | DelayExpr<TContext, TEvent>,
      i: number
    ) => {
      const delayRef = isFunction(delay) ? `${this.id}:delay[${i}]` : delay;

      const eventType = after(delayRef, this.id);

      this.onEntry.push(send(eventType, { delay }));
      this.onExit.push(cancel(eventType));

      return eventType;
    };

    const delayedTransitions = isArray(afterConfig)
      ? afterConfig.map((transition, i) => {
          const eventType = mutateEntryExit(transition.delay, i);
          return { ...transition, event: eventType };
        })
      : flatten(
          Object.keys(afterConfig).map((delay, i) => {
            const configTransition = afterConfig[delay];
            const resolvedTransition = isString(configTransition)
              ? { target: configTransition }
              : configTransition;

            const resolvedDelay = !isNaN(+delay) ? +delay : delay;

            const eventType = mutateEntryExit(resolvedDelay, i);

            return toArray(resolvedTransition).map((transition) => ({
              ...transition,
              event: eventType,
              delay: resolvedDelay
            }));
          })
        );

    return delayedTransitions.map((delayedTransition) => {
      const { delay } = delayedTransition;

      return {
        ...this.formatTransition(delayedTransition),
        delay
      };
    });
  }

  /**
   * Returns the state nodes represented by the current state value.
   *
   * @param state The state value or State instance
   */
  public getStateNodes(
    state:
      | StateValue
      | State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta>
  ): Array<
    StateNode<
      TContext,
      any,
      TEvent,
      TTypestate,
      TServiceMap,
      TResolvedTypesMeta
    >
  > {
    if (!state) {
      return [];
    }

    const stateValue =
      state instanceof State
        ? state.value
        : toStateValue(state, this.delimiter);

    if (isString(stateValue)) {
      const initialStateValue = this.getStateNode(stateValue).initial;

      return initialStateValue !== undefined
        ? this.getStateNodes({ [stateValue]: initialStateValue } as StateValue)
        : [this, this.states[stateValue]];
    }

    const subStateKeys = Object.keys(stateValue);
    const subStateNodes: Array<
      StateNode<
        TContext,
        any,
        TEvent,
        TTypestate,
        TServiceMap,
        TResolvedTypesMeta
      >
    > = [this];

    subStateNodes.push(
      ...flatten(
        subStateKeys.map((subStateKey) =>
          this.getStateNode(subStateKey).getStateNodes(stateValue[subStateKey])
        )
      )
    );

    return subStateNodes;
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
  public resolveState(
    state: State<TContext, TEvent, any, any> | StateConfig<TContext, TEvent>
  ): State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta> {
    const stateFromConfig =
      state instanceof State ? state : State.create(state);

    const configuration = Array.from(
      getConfiguration([], this.getStateNodes(stateFromConfig.value))
    );
    return new State({
      ...stateFromConfig,
      value: this.resolve(stateFromConfig.value),
      configuration,
      done: isInFinalState(configuration, this),
      tags: getTagsFromConfiguration(configuration),
      machine: (this.machine as unknown) as AnyStateMachine
    });
  }

  private transitionLeafNode(
    stateValue: string,
    state: State<TContext, TEvent>,
    _event: SCXML.Event<TEvent>
  ): StateTransition<TContext, TEvent> | undefined {
    const stateNode = this.getStateNode(stateValue);
    const next = stateNode.next(state, _event);

    if (!next || !next.transitions.length) {
      return this.next(state, _event);
    }

    return next;
  }
  private transitionCompoundNode(
    stateValue: StateValueMap,
    state: State<TContext, TEvent>,
    _event: SCXML.Event<TEvent>
  ): StateTransition<TContext, TEvent> | undefined {
    const subStateKeys = Object.keys(stateValue);

    const stateNode = this.getStateNode(subStateKeys[0]);
    const next = stateNode._transition(
      stateValue[subStateKeys[0]],
      state,
      _event
    );

    if (!next || !next.transitions.length) {
      return this.next(state, _event);
    }

    return next;
  }
  private transitionParallelNode(
    stateValue: StateValueMap,
    state: State<TContext, TEvent>,
    _event: SCXML.Event<TEvent>
  ): StateTransition<TContext, TEvent> | undefined {
    const transitionMap: Record<string, StateTransition<TContext, TEvent>> = {};

    for (const subStateKey of Object.keys(stateValue)) {
      const subStateValue = stateValue[subStateKey];

      if (!subStateValue) {
        continue;
      }

      const subStateNode = this.getStateNode(subStateKey);
      const next = subStateNode._transition(subStateValue, state, _event);
      if (next) {
        transitionMap[subStateKey] = next;
      }
    }

    const stateTransitions = Object.keys(transitionMap).map(
      (key) => transitionMap[key]
    );
    const enabledTransitions = flatten(
      stateTransitions.map((st) => st.transitions)
    );

    const willTransition = stateTransitions.some(
      (st) => st.transitions.length > 0
    );

    if (!willTransition) {
      return this.next(state, _event);
    }
    const entryNodes = flatten(stateTransitions.map((t) => t.entrySet));

    const configuration = flatten(
      Object.keys(transitionMap).map((key) => transitionMap[key].configuration)
    );

    return {
      transitions: enabledTransitions,
      entrySet: entryNodes,
      exitSet: flatten(stateTransitions.map((t) => t.exitSet)),
      configuration,
      source: state,
      actions: flatten(
        Object.keys(transitionMap).map((key) => {
          return transitionMap[key].actions;
        })
      )
    };
  }
  private _transition(
    stateValue: StateValue,
    state: State<TContext, TEvent, any, any, any>,
    _event: SCXML.Event<TEvent>
  ): StateTransition<TContext, TEvent> | undefined {
    // leaf node
    if (isString(stateValue)) {
      return this.transitionLeafNode(stateValue, state, _event);
    }

    // hierarchical node
    if (Object.keys(stateValue).length === 1) {
      return this.transitionCompoundNode(stateValue, state, _event);
    }

    // orthogonal node
    return this.transitionParallelNode(stateValue, state, _event);
  }
  public getTransitionData(
    state: State<TContext, TEvent, any, any, any>,
    event: Event<TEvent> | SCXML.Event<TEvent>
  ) {
    return this._transition(state.value, state, toSCXMLEvent(event));
  }
  private next(
    state: State<TContext, TEvent>,
    _event: SCXML.Event<TEvent>
  ): StateTransition<TContext, TEvent> | undefined {
    const eventName = _event.name;
    const actions: Array<ActionObject<TContext, TEvent>> = [];

    let nextStateNodes: Array<StateNode<TContext, any, TEvent>> = [];
    let selectedTransition: TransitionDefinition<TContext, TEvent> | undefined;

    for (const candidate of this.getCandidates(eventName)) {
      const { cond, in: stateIn } = candidate;
      const resolvedContext = state.context;

      const isInState = stateIn
        ? isString(stateIn) && isStateId(stateIn)
          ? // Check if in state by ID
            state.matches(
              toStateValue(this.getStateNodeById(stateIn).path, this.delimiter)
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
          !cond ||
          evaluateGuard(this.machine, cond, resolvedContext, _event, state);
      } catch (err) {
        throw new Error(
          `Unable to evaluate guard '${
            cond!.name || cond!.type
          }' in transition for event '${eventName}' in state node '${
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
      nextStateNodes.map((stateNode) => {
        return this.getRelativeStateNodes(stateNode, state.historyValue);
      })
    );

    const isInternal = !!selectedTransition.internal;

    const reentryNodes: StateNode<any, any, any, any, any>[] = [];

    if (!isInternal) {
      nextStateNodes.forEach((targetNode) => {
        reentryNodes.push(...this.getExternalReentryNodes(targetNode));
      });
    }

    return {
      transitions: [selectedTransition],
      entrySet: reentryNodes,
      exitSet: isInternal ? [] : [this],
      configuration: allNextStateNodes,
      source: state,
      actions
    };
  }

  private getExternalReentryNodes(
    targetNode: StateNode<TContext, any, TEvent, any, any, any>
  ): Array<StateNode<TContext, any, TEvent, any, any, any>> {
    const nodes: Array<StateNode<TContext, any, TEvent, any, any, any>> = [];
    let [marker, possibleAncestor]: [
      StateNode<TContext, any, TEvent, any, any, any> | undefined,
      StateNode<TContext, any, TEvent, any, any, any>
    ] = targetNode.order > this.order ? [targetNode, this] : [this, targetNode];

    while (marker && marker !== possibleAncestor) {
      nodes.push(marker);
      marker = marker.parent;
    }
    if (marker !== possibleAncestor) {
      // we never got to `possibleAncestor`, therefore the initial `marker` "escapes" it
      // it's in a different part of the tree so no states will be reentered for such an external transition
      return [];
    }
    nodes.push(possibleAncestor);
    return nodes;
  }

  private getActions(
    resolvedConfig: Set<StateNode<any, any, any, any, any, any>>,
    isDone: boolean,
    transition: StateTransition<TContext, TEvent>,
    currentContext: TContext,
    _event: SCXML.Event<TEvent>,
    prevState?: State<TContext, any, any, any, any>,
    predictableExec?: PredictableActionArgumentsExec
  ): Array<Array<ActionObject<TContext, TEvent>>> {
    const prevConfig = getConfiguration(
      [],
      prevState ? this.getStateNodes(prevState.value) : [this]
    );

    for (const sn of resolvedConfig) {
      if (
        !has(prevConfig, sn) ||
        (has(transition.entrySet, sn.parent) && !has(transition.entrySet, sn))
      ) {
        transition.entrySet.push(sn);
      }
    }
    for (const sn of prevConfig) {
      if (!has(resolvedConfig, sn) || has(transition.exitSet, sn.parent)) {
        transition.exitSet.push(sn);
      }
    }

    const doneEvents = flatten(
      transition.entrySet.map((sn) => {
        const events: DoneEventObject[] = [];

        if (sn.type !== 'final') {
          return events;
        }

        const parent = sn.parent!;

        if (!parent.parent) {
          return events;
        }

        events.push(
          done(sn.id, sn.doneData), // TODO: deprecate - final states should not emit done events for their own state.
          done(
            parent.id,
            sn.doneData
              ? mapContext(sn.doneData, currentContext, _event)
              : undefined
          )
        );

        const grandparent = parent.parent!;

        if (grandparent.type === 'parallel') {
          if (
            getChildren(grandparent).every((parentNode) =>
              isInFinalState(transition.configuration, parentNode)
            )
          ) {
            events.push(done(grandparent.id));
          }
        }

        return events;
      })
    );

    transition.exitSet.sort((a, b) => b.order - a.order);
    transition.entrySet.sort((a, b) => a.order - b.order);

    const entryStates = new Set(transition.entrySet);
    const exitStates = new Set(transition.exitSet);

    const entryActions = Array.from(entryStates)
      .map((stateNode) => {
        const entryActions = stateNode.onEntry;
        const invokeActions = stateNode.activities.map((activity) =>
          start(activity)
        );
        return toActionObjects(
          predictableExec
            ? [...entryActions, ...invokeActions]
            : [...invokeActions, ...entryActions],
          this.machine.options.actions as any
        );
      })
      .concat([doneEvents.map(raise) as Array<ActionObject<TContext, TEvent>>]);

    const exitActions = Array.from(exitStates).map((stateNode) =>
      toActionObjects(
        [
          ...stateNode.onExit,
          ...stateNode.activities.map((activity) => stop(activity))
        ],
        this.machine.options.actions as any
      )
    );

    const actions = exitActions
      .concat([
        toActionObjects(transition.actions, this.machine.options.actions as any)
      ])
      .concat(entryActions);

    if (isDone) {
      const stopActions = toActionObjects(
        flatten(
          [...resolvedConfig]
            .sort((a, b) => b.order - a.order)
            .map((stateNode) => stateNode.onExit)
        ),
        this.machine.options.actions as any
      ).filter(
        (action) =>
          action.type !== actionTypes.raise &&
          (action.type !== actionTypes.send ||
            (!!action.to && action.to !== SpecialTargets.Internal))
      );
      return actions.concat([stopActions]);
    }

    return actions;
  }

  /**
   * Determines the next state given the current `state` and sent `event`.
   *
   * @param state The current State instance or state value
   * @param event The event that was sent at the current state
   * @param context The current context (extended state) of the current state
   */
  public transition(
    state:
      | StateValue
      | State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta> = this
      .initialState,
    event: Event<TEvent> | SCXML.Event<TEvent>,
    context?: TContext,
    exec?: PredictableActionArgumentsExec
  ): State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta> {
    const _event = toSCXMLEvent(event);

    let currentState: State<
      TContext,
      TEvent,
      any,
      TTypestate,
      TResolvedTypesMeta
    >;

    if (state instanceof State) {
      currentState =
        context === undefined
          ? state
          : this.resolveState(State.from(state, context));
    } else {
      const resolvedStateValue = isString(state)
        ? this.resolve(pathToStateValue(this.getResolvedPath(state)))
        : this.resolve(state);
      const resolvedContext = context ?? this.machine.context;

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

    const stateTransition = this._transition(
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
      this.getStateNodes(currentState.value)
    );
    const resolvedConfig = stateTransition.configuration.length
      ? getConfiguration(prevConfig, stateTransition.configuration)
      : prevConfig;

    stateTransition.configuration = [...resolvedConfig];

    return this.resolveTransition(
      stateTransition,
      currentState,
      currentState.context,
      exec,
      _event
    );
  }

  private resolveRaisedTransition(
    state: State<
      TContext,
      TEvent,
      TStateSchema,
      TTypestate,
      TResolvedTypesMeta
    >,
    _event: SCXML.Event<TEvent> | NullEvent,
    originalEvent: SCXML.Event<TEvent>,
    predictableExec?: PredictableActionArgumentsExec
  ): State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta> {
    const currentActions = state.actions;

    state = this.transition(
      state,
      _event as SCXML.Event<TEvent>,
      undefined,
      predictableExec
    );
    // Save original event to state
    // TODO: this should be the raised event! Delete in V5 (breaking)
    state._event = originalEvent;
    state.event = originalEvent.data;

    state.actions.unshift(...currentActions);
    return state;
  }

  private resolveTransition(
    stateTransition: StateTransition<TContext, TEvent>,
    currentState: State<TContext, TEvent, any, any, any> | undefined,
    context: TContext,
    predictableExec?: PredictableActionArgumentsExec,
    _event: SCXML.Event<TEvent> = initEvent as SCXML.Event<TEvent>
  ): State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta> {
    const { configuration } = stateTransition;

    // Transition will "apply" if:
    // - this is the initial state (there is no current state)
    // - OR there are transitions
    const willTransition =
      !currentState || stateTransition.transitions.length > 0;

    const resolvedConfiguration = willTransition
      ? stateTransition.configuration
      : currentState
      ? currentState.configuration
      : [];

    const isDone = isInFinalState(resolvedConfiguration, this);

    const resolvedStateValue = willTransition
      ? getValue(this.machine, configuration)
      : undefined;
    const historyValue = currentState
      ? currentState.historyValue
        ? currentState.historyValue
        : stateTransition.source
        ? (this.machine.historyValue(currentState.value) as HistoryValue)
        : undefined
      : undefined;
    const actionBlocks = this.getActions(
      new Set(resolvedConfiguration),
      isDone,
      stateTransition,
      context,
      _event,
      currentState,
      predictableExec
    );
    const activities = currentState ? { ...currentState.activities } : {};
    for (const block of actionBlocks) {
      for (const action of block) {
        if (action.type === actionTypes.start) {
          activities[
            action.activity!.id || action.activity!.type
          ] = action as ActivityDefinition<TContext, TEvent>;
        } else if (action.type === actionTypes.stop) {
          activities[action.activity!.id || action.activity!.type] = false;
        }
      }
    }

    const [resolvedActions, updatedContext] = resolveActions(
      this,
      currentState,
      context,
      _event,
      actionBlocks,
      predictableExec,
      this.machine.config.predictableActionArguments ||
        this.machine.config.preserveActionOrder
    );

    const [raisedEvents, nonRaisedActions] = partition(
      resolvedActions,
      (
        action
      ): action is
        | RaiseActionObject<TEvent>
        | SendActionObject<TContext, TEvent, TEvent> =>
        action.type === actionTypes.raise ||
        (action.type === actionTypes.send &&
          (action as SendActionObject<TContext, TEvent>).to ===
            SpecialTargets.Internal)
    );

    const invokeActions = resolvedActions.filter((action) => {
      return (
        action.type === actionTypes.start &&
        (action as ActivityActionObject<TContext, TEvent>).activity?.type ===
          actionTypes.invoke
      );
    }) as Array<InvokeActionObject<TContext, TEvent>>;

    const children = invokeActions.reduce(
      (acc, action) => {
        acc[action.activity.id] = createInvocableActor(
          action.activity,
          this.machine as any,
          updatedContext,
          _event
        );

        return acc;
      },
      currentState
        ? { ...currentState.children }
        : ({} as Record<string, ActorRef<any>>)
    );

    const nextState = new State<
      TContext,
      TEvent,
      TStateSchema,
      TTypestate,
      TResolvedTypesMeta
    >({
      value: resolvedStateValue || currentState!.value,
      context: updatedContext,
      _event,
      // Persist _sessionid between states
      _sessionid: currentState ? currentState._sessionid : null,
      historyValue: resolvedStateValue
        ? historyValue
          ? updateHistoryValue(historyValue, resolvedStateValue)
          : undefined
        : currentState
        ? currentState.historyValue
        : undefined,
      history:
        !resolvedStateValue || stateTransition.source
          ? currentState
          : undefined,
      actions: resolvedStateValue ? nonRaisedActions : ([] as any[]),
      activities: resolvedStateValue
        ? activities
        : currentState
        ? currentState.activities
        : {},
      events: [],
      configuration: resolvedConfiguration,
      transitions: stateTransition.transitions,
      children,
      done: isDone,
      tags: getTagsFromConfiguration(resolvedConfiguration),
      machine: this as any
    });

    const didUpdateContext = context !== updatedContext;

    nextState.changed = _event.name === actionTypes.update || didUpdateContext;

    // Dispose of penultimate histories to prevent memory leaks
    const { history } = nextState;
    if (history) {
      delete history.history;
    }

    // There are transient transitions if the machine is not in a final state
    // and if some of the state nodes have transient ("always") transitions.
    const hasAlwaysTransitions =
      !isDone &&
      (this._transient ||
        configuration.some((stateNode) => {
          return stateNode._transient;
        }));

    // If there are no enabled transitions, check if there are transient transitions.
    // If there are transient transitions, continue checking for more transitions
    // because an transient transition should be triggered even if there are no
    // enabled transitions.
    //
    // If we're already working on an transient transition then stop to prevent an infinite loop.
    //
    // Otherwise, if there are no enabled nor transient transitions, we are done.
    if (
      !willTransition &&
      (!hasAlwaysTransitions || _event.name === NULL_EVENT)
    ) {
      return nextState;
    }

    let maybeNextState = nextState;

    if (!isDone) {
      if (hasAlwaysTransitions) {
        maybeNextState = this.resolveRaisedTransition(
          maybeNextState,
          {
            type: actionTypes.nullEvent
          },
          _event,
          predictableExec
        );
      }

      while (raisedEvents.length) {
        const raisedEvent = raisedEvents.shift()!;
        maybeNextState = this.resolveRaisedTransition(
          maybeNextState,
          raisedEvent._event,
          _event,
          predictableExec
        );
      }
    }

    // Detect if state changed
    const changed =
      maybeNextState.changed ||
      (history
        ? !!maybeNextState.actions.length ||
          didUpdateContext ||
          typeof history.value !== typeof maybeNextState.value ||
          !stateValuesEqual(maybeNextState.value, history.value)
        : undefined);

    maybeNextState.changed = changed;

    // Preserve original history after raised events
    maybeNextState.history = history;

    return maybeNextState;
  }

  /**
   * Returns the child state node from its relative `stateKey`, or throws.
   */
  public getStateNode(
    stateKey: string
  ): StateNode<
    TContext,
    any,
    TEvent,
    TTypestate,
    TServiceMap,
    TResolvedTypesMeta
  > {
    if (isStateId(stateKey)) {
      return this.machine.getStateNodeById(stateKey) as any;
    }

    if (!this.states) {
      throw new Error(
        `Unable to retrieve child state '${stateKey}' from '${this.id}'; no child states exist.`
      );
    }

    const result = this.states[stateKey];
    if (!result) {
      throw new Error(
        `Child state '${stateKey}' does not exist on '${this.id}'`
      );
    }

    return result;
  }

  /**
   * Returns the state node with the given `stateId`, or throws.
   *
   * @param stateId The state ID. The prefix "#" is removed.
   */
  public getStateNodeById(
    stateId: string
  ): StateNode<TContext, any, TEvent, any, TServiceMap, TResolvedTypesMeta> {
    const resolvedStateId = isStateId(stateId)
      ? stateId.slice(STATE_IDENTIFIER.length)
      : stateId;

    if (resolvedStateId === this.id) {
      return this;
    }

    const stateNode = this.machine.idMap[resolvedStateId];

    if (!stateNode) {
      throw new Error(
        `Child state node '#${resolvedStateId}' does not exist on machine '${this.id}'`
      );
    }

    return stateNode;
  }

  /**
   * Returns the relative state node from the given `statePath`, or throws.
   *
   * @param statePath The string or string array relative path to the state node.
   */
  public getStateNodeByPath(
    statePath: string | string[]
  ): StateNode<TContext, any, TEvent, any, any, any> {
    if (typeof statePath === 'string' && isStateId(statePath)) {
      try {
        return this.getStateNodeById(statePath.slice(1));
      } catch (e) {
        // try individual paths
        // throw e;
      }
    }

    const arrayStatePath = toStatePath(statePath, this.delimiter).slice();
    let currentStateNode: StateNode<
      TContext,
      any,
      TEvent,
      any,
      any,
      any
    > = this;
    while (arrayStatePath.length) {
      const key = arrayStatePath.shift()!;

      if (!key.length) {
        break;
      }

      currentStateNode = currentStateNode.getStateNode(key);
    }

    return currentStateNode;
  }

  /**
   * Resolves a partial state value with its full representation in this machine.
   *
   * @param stateValue The partial state value to resolve.
   */
  public resolve(stateValue: StateValue): StateValue {
    if (!stateValue) {
      return this.initialStateValue || EMPTY_OBJECT; // TODO: type-specific properties
    }

    switch (this.type) {
      case 'parallel':
        return mapValues(
          this.initialStateValue as Record<string, StateValue>,
          (subStateValue, subStateKey) => {
            return subStateValue
              ? this.getStateNode(subStateKey).resolve(
                  stateValue[subStateKey] || subStateValue
                )
              : EMPTY_OBJECT;
          }
        );

      case 'compound':
        if (isString(stateValue)) {
          const subStateNode = this.getStateNode(stateValue);

          if (
            subStateNode.type === 'parallel' ||
            subStateNode.type === 'compound'
          ) {
            return { [stateValue]: subStateNode.initialStateValue! };
          }

          return stateValue;
        }
        if (!Object.keys(stateValue).length) {
          return this.initialStateValue || {};
        }

        return mapValues(stateValue, (subStateValue, subStateKey) => {
          return subStateValue
            ? this.getStateNode(subStateKey as string).resolve(subStateValue)
            : EMPTY_OBJECT;
        });

      default:
        return stateValue || EMPTY_OBJECT;
    }
  }

  private getResolvedPath(stateIdentifier: string): string[] {
    if (isStateId(stateIdentifier)) {
      const stateNode = this.machine.idMap[
        stateIdentifier.slice(STATE_IDENTIFIER.length)
      ];

      if (!stateNode) {
        throw new Error(`Unable to find state node '${stateIdentifier}'`);
      }

      return stateNode.path;
    }

    return toStatePath(stateIdentifier, this.delimiter);
  }
  private get initialStateValue(): StateValue | undefined {
    if (this.__cache.initialStateValue) {
      return this.__cache.initialStateValue;
    }

    let initialStateValue: StateValue | undefined;

    if (this.type === 'parallel') {
      initialStateValue = mapFilterValues(
        this.states as Record<string, StateNode<TContext, any, TEvent>>,
        (state) => state.initialStateValue || EMPTY_OBJECT,
        (stateNode) => !(stateNode.type === 'history')
      );
    } else if (this.initial !== undefined) {
      if (!this.states[this.initial as string]) {
        throw new Error(
          `Initial state '${this.initial as string}' not found on '${this.key}'`
        );
      }

      initialStateValue = (isLeafNode(this.states[this.initial as string])
        ? this.initial
        : {
            [this.initial]: this.states[this.initial as string]
              .initialStateValue
          }) as StateValue;
    } else {
      // The finite state value of a machine without child states is just an empty object
      initialStateValue = {};
    }

    this.__cache.initialStateValue = initialStateValue;

    return this.__cache.initialStateValue;
  }

  public getInitialState(
    stateValue: StateValue,
    context?: TContext
  ): State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta> {
    this._init(); // TODO: this should be in the constructor (see note in constructor)
    const configuration = this.getStateNodes(stateValue);

    return this.resolveTransition(
      {
        configuration,
        entrySet: configuration,
        exitSet: [],
        transitions: [],
        source: undefined,
        actions: []
      },
      undefined,
      context ?? this.machine.context,
      undefined
    );
  }

  /**
   * The initial State instance, which includes all actions to be executed from
   * entering the initial state.
   */
  public get initialState(): State<
    TContext,
    TEvent,
    TStateSchema,
    TTypestate,
    TResolvedTypesMeta
  > {
    const { initialStateValue } = this;

    if (!initialStateValue) {
      throw new Error(
        `Cannot retrieve initial state from simple state '${this.id}'.`
      );
    }

    return this.getInitialState(initialStateValue);
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
              this.machine
                .getStateNodeById(historyConfig.target)
                .path.slice(this.path.length - 1)
            )
          : historyConfig.target;
      } else {
        target = historyConfig.target;
      }
    }

    return target;
  }

  /**
   * Returns the leaf nodes from a state path relative to this state node.
   *
   * @param relativeStateId The relative state path to retrieve the state nodes
   * @param history The previous state to retrieve history
   * @param resolve Whether state nodes should resolve to initial child state nodes
   */
  public getRelativeStateNodes(
    relativeStateId: StateNode<TContext, any, TEvent>,
    historyValue?: HistoryValue,
    resolve: boolean = true
  ): Array<StateNode<TContext, any, TEvent>> {
    return resolve
      ? relativeStateId.type === 'history'
        ? relativeStateId.resolveHistory(historyValue)
        : relativeStateId.initialStateNodes
      : [relativeStateId];
  }
  public get initialStateNodes(): Array<
    StateNode<TContext, any, TEvent, any, any, any>
  > {
    if (isLeafNode(this)) {
      return [this];
    }

    // Case when state node is compound but no initial state is defined
    if (this.type === 'compound' && !this.initial) {
      if (!IS_PRODUCTION) {
        warn(false, `Compound state node '${this.id}' has no initial state.`);
      }
      return [this];
    }

    const initialStateNodePaths = toStatePaths(this.initialStateValue!);
    return flatten(
      initialStateNodePaths.map((initialPath) =>
        this.getFromRelativePath(initialPath)
      )
    );
  }
  /**
   * Retrieves state nodes from a relative path to this state node.
   *
   * @param relativePath The relative path from this state node
   * @param historyValue
   */
  public getFromRelativePath(
    relativePath: string[]
  ): Array<StateNode<TContext, any, TEvent, any, any, any>> {
    if (!relativePath.length) {
      return [this];
    }

    const [stateKey, ...childStatePath] = relativePath;

    if (!this.states) {
      throw new Error(
        `Cannot retrieve subPath '${stateKey}' from node with no states`
      );
    }

    const childStateNode = this.getStateNode(stateKey);

    if (childStateNode.type === 'history') {
      return childStateNode.resolveHistory();
    }

    if (!this.states[stateKey]) {
      throw new Error(
        `Child state '${stateKey}' does not exist on '${this.id}'`
      );
    }

    return this.states[stateKey].getFromRelativePath(childStatePath);
  }

  private historyValue(
    relativeStateValue?: StateValue | undefined
  ): HistoryValue | undefined {
    if (!Object.keys(this.states).length) {
      return undefined;
    }

    return {
      current: relativeStateValue || this.initialStateValue,
      states: mapFilterValues<
        StateNode<TContext, any, TEvent>,
        HistoryValue | undefined
      >(
        this.states,
        (stateNode, key) => {
          if (!relativeStateValue) {
            return stateNode.historyValue();
          }

          const subStateValue = isString(relativeStateValue)
            ? undefined
            : relativeStateValue[key];

          return stateNode.historyValue(
            subStateValue || stateNode.initialStateValue
          );
        },
        (stateNode) => !stateNode.history
      )
    };
  }
  /**
   * Resolves to the historical value(s) of the parent state node,
   * represented by state nodes.
   *
   * @param historyValue
   */
  private resolveHistory(
    historyValue?: HistoryValue
  ): Array<StateNode<TContext, any, TEvent, any, any, any>> {
    if (this.type !== 'history') {
      return [this];
    }

    const parent = this.parent!;

    if (!historyValue) {
      const historyTarget = this.target;
      return historyTarget
        ? flatten(
            toStatePaths(historyTarget).map((relativeChildPath) =>
              parent.getFromRelativePath(relativeChildPath)
            )
          )
        : parent.initialStateNodes;
    }

    const subHistoryValue = nestedPath<HistoryValue>(
      parent.path,
      'states'
    )(historyValue).current;

    if (isString(subHistoryValue)) {
      return [parent.getStateNode(subHistoryValue)];
    }

    return flatten(
      toStatePaths(subHistoryValue!).map((subStatePath) => {
        return this.history === 'deep'
          ? parent.getFromRelativePath(subStatePath)
          : [parent.states[subStatePath[0]]];
      })
    );
  }

  /**
   * All the state node IDs of this state node and its descendant state nodes.
   */
  public get stateIds(): string[] {
    const childStateIds = flatten(
      Object.keys(this.states).map((stateKey) => {
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
      for (const stateId of Object.keys(states)) {
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
        .filter((transition) => {
          return !(
            !transition.target &&
            !transition.actions.length &&
            transition.internal
          );
        })
        .map((transition) => transition.eventType)
    );

    return Array.from(events);
  }
  private resolveTarget(
    _target: Array<string | StateNode<TContext, any, TEvent>> | undefined
  ): Array<StateNode<TContext, any, TEvent>> | undefined {
    if (_target === undefined) {
      // an undefined target signals that the state node should not transition from that state when receiving that event
      return undefined;
    }

    return _target.map((target) => {
      if (!isString(target)) {
        return target;
      }

      const isInternalTarget = target[0] === this.delimiter;

      // If internal target is defined on machine,
      // do not include machine key on target
      if (isInternalTarget && !this.parent) {
        return this.getStateNodeByPath(target.slice(1));
      }

      const resolvedTarget = isInternalTarget ? this.key + target : target;

      if (this.parent) {
        try {
          const targetStateNode = this.parent.getStateNodeByPath(
            resolvedTarget
          );
          return targetStateNode;
        } catch (err) {
          throw new Error(
            `Invalid transition definition for state node '${this.id}':\n${err.message}`
          );
        }
      } else {
        return this.getStateNodeByPath(resolvedTarget);
      }
    });
  }

  private formatTransition(
    transitionConfig: TransitionConfig<TContext, TEvent> & {
      event: TEvent['type'] | NullEvent['type'] | '*';
    }
  ): TransitionDefinition<TContext, TEvent> {
    const normalizedTarget = normalizeTarget(transitionConfig.target);
    const internal =
      'internal' in transitionConfig
        ? transitionConfig.internal
        : normalizedTarget
        ? normalizedTarget.some(
            (_target) => isString(_target) && _target[0] === this.delimiter
          )
        : true;
    const { guards } = this.machine.options;

    const target = this.resolveTarget(normalizedTarget);

    const transition = {
      ...transitionConfig,
      actions: toActionObjects(toArray(transitionConfig.actions)),
      cond: toGuard(transitionConfig.cond, guards as any),
      target,
      source: this as any,
      internal,
      eventType: transitionConfig.event,
      toJSON: () => ({
        ...transition,
        target: transition.target
          ? transition.target.map((t) => `#${t.id}`)
          : undefined,
        source: `#${this.id}`
      })
    };

    return transition;
  }
  private formatTransitions(): Array<TransitionDefinition<TContext, TEvent>> {
    let onConfig: Array<
      TransitionConfig<TContext, EventObject> & {
        event: string;
      }
    >;

    if (!this.config.on) {
      onConfig = [];
    } else if (Array.isArray(this.config.on)) {
      onConfig = this.config.on;
    } else {
      const {
        [WILDCARD]: wildcardConfigs = [],
        ...strictTransitionConfigs
      } = this.config.on;

      onConfig = flatten(
        Object.keys(strictTransitionConfigs)
          .map((key) => {
            if (!IS_PRODUCTION && key === NULL_EVENT) {
              warn(
                false,
                `Empty string transition configs (e.g., \`{ on: { '': ... }}\`) for transient transitions are deprecated. Specify the transition in the \`{ always: ... }\` property instead. ` +
                  `Please check the \`on\` configuration for "#${this.id}".`
              );
            }
            const transitionConfigArray = toTransitionConfigArray<
              TContext,
              EventObject
            >(key, strictTransitionConfigs[key as string]);
            if (!IS_PRODUCTION) {
              validateArrayifiedTransitions(this, key, transitionConfigArray);
            }
            return transitionConfigArray;
          })
          .concat(
            toTransitionConfigArray(
              WILDCARD,
              wildcardConfigs as SingleOrArray<
                TransitionConfig<TContext, EventObject> & {
                  event: '*';
                }
              >
            )
          )
      );
    }

    const eventlessConfig = this.config.always
      ? toTransitionConfigArray('', this.config.always)
      : [];

    const doneConfig = this.config.onDone
      ? toTransitionConfigArray(String(done(this.id)), this.config.onDone)
      : [];

    if (!IS_PRODUCTION) {
      warn(
        !(this.config.onDone && !this.parent),
        `Root nodes cannot have an ".onDone" transition. Please check the config of "${this.id}".`
      );
    }

    const invokeConfig = flatten(
      this.invoke.map((invokeDef) => {
        const settleTransitions: any[] = [];
        if (invokeDef.onDone) {
          settleTransitions.push(
            ...toTransitionConfigArray(
              String(doneInvoke(invokeDef.id)),
              invokeDef.onDone
            )
          );
        }
        if (invokeDef.onError) {
          settleTransitions.push(
            ...toTransitionConfigArray(
              String(error(invokeDef.id)),
              invokeDef.onError
            )
          );
        }
        return settleTransitions;
      })
    );

    const delayedTransitions = this.after;

    const formattedTransitions = flatten(
      [...doneConfig, ...invokeConfig, ...onConfig, ...eventlessConfig].map(
        (
          transitionConfig: TransitionConfig<TContext, TEvent> & {
            event: TEvent['type'] | NullEvent['type'] | '*';
          }
        ) =>
          toArray(transitionConfig).map((transition) =>
            this.formatTransition(transition)
          )
      )
    );

    for (const delayedTransition of delayedTransitions) {
      formattedTransitions.push(delayedTransition as any);
    }

    return formattedTransitions;
  }
}

export { StateNode };
