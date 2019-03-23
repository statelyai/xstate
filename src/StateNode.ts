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
  keys,
  isBuiltInEvent,
  partition,
  updateHistoryValue,
  updateContext
} from './utils';
import {
  Event,
  StateValue,
  Action,
  TransitionConfig,
  ActivityMap,
  StateTransition,
  StateValueMap,
  MachineOptions,
  Condition,
  ConditionPredicate,
  EventObject,
  HistoryStateNodeConfig,
  HistoryValue,
  DefaultContext,
  StateNodeDefinition,
  TransitionDefinition,
  AssignAction,
  DelayedTransitionDefinition,
  ActivityDefinition,
  StateTypes,
  StateNodeConfig,
  Activity,
  StateSchema,
  TransitionsDefinition,
  StatesDefinition,
  StateNodesConfig,
  ActionTypes,
  OmniEventObject,
  RaisedEvent,
  FinalStateNodeConfig,
  InvokeDefinition,
  OmniEvent,
  ActionObject,
  Mapper,
  PropertyMapper,
  SendAction,
  BuiltInEvent,
  Guard,
  GuardPredicate,
  GuardMeta,
  MachineConfig
} from './types';
import { matchesState } from './utils';
import { State, stateValuesEqual } from './State';
import * as actionTypes from './actionTypes';
import {
  start,
  stop,
  toEventObject,
  toActivityDefinition,
  send,
  cancel,
  after,
  raise,
  done,
  doneInvoke,
  toActionObject,
  resolveSend,
  initEvent
} from './actions';
import { StateTree } from './StateTree';

const STATE_DELIMITER = '.';
const NULL_EVENT = '';
const STATE_IDENTIFIER = '#';
const TARGETLESS_KEY = '';

const EMPTY_OBJECT = {};

const isStateId = (str: string) => str[0] === STATE_IDENTIFIER;
const createDefaultOptions = <TContext>(): MachineOptions<TContext, any> => ({
  actions: {},
  guards: {},
  services: {},
  activities: {},
  delays: {},
  updater: updateContext
});

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

class StateNode<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends OmniEventObject<EventObject> = OmniEventObject<EventObject>
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
  public type: StateTypes;
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
  public parallel: boolean;
  /**
   * Whether the state node is "transient". A state node is considered transient if it has
   * an immediate transition from a "null event" (empty string), taken upon entering the state node.
   */
  public transient: boolean;
  /**
   * The child state nodes.
   */
  public states: StateNodesConfig<TContext, TStateSchema, TEvent>;
  /**
   * The type of history exhibited. Can be:
   *
   *  - `'shallow'` - recalls only top-level historical state value
   *  - `'deep'` - recalls historical state value at all levels
   */
  public history: false | 'shallow' | 'deep';
  /**
   * The action(s) to be executed upon entering the state node.
   */
  public onEntry: Array<ActionObject<TContext, TEvent>>;
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  public onExit: Array<ActionObject<TContext, TEvent>>;
  /**
   * The activities to be started upon entering the state node,
   * and stopped upon exiting the state node.
   */
  public activities: Array<ActivityDefinition<TContext, TEvent>>;
  /**
   * The delayed transitions.
   */
  public after: Array<DelayedTransitionDefinition<TContext, TEvent>>;
  public strict: boolean;
  /**
   * The parent state node.
   */
  public parent?: StateNode<TContext>;
  /**
   * The root machine node.
   */
  public machine: StateNode<TContext>;
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
  public order: number;
  /**
   * The services invoked by this state node.
   */
  public invoke: Array<InvokeDefinition<TContext, TEvent>>;

  public options: MachineOptions<TContext, TEvent>;

  private __cache = {
    events: undefined as Array<TEvent['type']> | undefined,
    relativeValue: new Map() as Map<StateNode<TContext>, StateValue>,
    initialState: undefined as StateValue | undefined
  };

  private idMap: Record<string, StateNode<TContext>> = {};

  constructor(
    private _config: StateNodeConfig<TContext, TStateSchema, TEvent>,
    options?: Partial<MachineOptions<TContext, TEvent>>,
    /**
     * The initial extended state
     */
    public context?: Readonly<TContext>
  ) {
    this.options = {
      ...createDefaultOptions<TContext>(),
      ...options
    };
    this.key = _config.key || _config.id || '(machine)';
    this.parent = _config.parent;
    this.machine = this.parent ? this.parent.machine : this;
    this.path = this.parent ? this.parent.path.concat(this.key) : [];
    this.delimiter =
      _config.delimiter ||
      (this.parent ? this.parent.delimiter : STATE_DELIMITER);
    this.id =
      _config.id ||
      (this.machine
        ? [this.machine.key, ...this.path].join(this.delimiter)
        : this.key);
    this.version = this.parent
      ? this.parent.version
      : (_config as MachineConfig<TContext, TStateSchema, TEvent>).version;
    this.type =
      _config.type ||
      (_config.parallel
        ? 'parallel'
        : _config.states && keys(_config.states).length
        ? 'compound'
        : _config.history
        ? 'history'
        : 'atomic');
    if (!IS_PRODUCTION && 'parallel' in _config) {
      // tslint:disable-next-line:no-console
      console.warn(
        `The "parallel" property is deprecated and will be removed in version 4.1. ${
          _config.parallel
            ? `Replace with \`type: 'parallel'\``
            : `Use \`type: '${this.type}'\``
        } in the config for state node '${this.id}' instead.`
      );
    }
    this.initial = _config.initial;
    this.order = _config.order || -1;

    this.states = (_config.states
      ? mapValues(
          _config.states,
          (stateConfig: StateNodeConfig<TContext, any, TEvent>, key, _, i) => {
            const stateNode = new StateNode({
              ...stateConfig,
              key,
              order: stateConfig.order === undefined ? i : stateConfig.order,
              parent: this
            });
            Object.assign(this.idMap, {
              [stateNode.id]: stateNode,
              ...stateNode.idMap
            });
            return stateNode;
          }
        )
      : EMPTY_OBJECT) as StateNodesConfig<TContext, TStateSchema, TEvent>;

    // History config
    this.history =
      _config.history === true ? 'shallow' : _config.history || false;

    this.transient = !!(_config.on && _config.on[NULL_EVENT]);
    this.strict = !!_config.strict;
    this.onEntry = toArray(_config.onEntry).map(action =>
      toActionObject(action)
    );
    this.onExit = toArray(_config.onExit).map(action => toActionObject(action));
    this.meta = _config.meta;
    this.data =
      this.type === 'final'
        ? (_config as FinalStateNodeConfig<TContext, TEvent>).data
        : undefined;
    this.invoke = toArray(_config.invoke).map((invokeConfig, i) => {
      if (invokeConfig instanceof StateNode) {
        (this.parent || this).options.services = {
          [invokeConfig.id]: invokeConfig,
          ...(this.parent || this).options.services
        };

        return {
          type: actionTypes.invoke,
          src: invokeConfig.id,
          id: invokeConfig.id
        };
      } else if (typeof invokeConfig.src !== 'string') {
        const invokeSrc = `${this.id}:invocation[${i}]`; // TODO: util function
        this.machine.options.services = {
          [invokeSrc]: invokeConfig.src,
          ...this.machine.options.services
        };

        return {
          type: actionTypes.invoke,
          id: invokeSrc,
          ...invokeConfig,
          src: invokeSrc
        };
      } else {
        return {
          ...invokeConfig,
          type: actionTypes.invoke,
          id: invokeConfig.id || (invokeConfig.src as string),
          src: invokeConfig.src as string
        };
      }
    });
    this.activities = toArray(_config.activities)
      .concat(this.invoke)
      .map(activity => this.resolveActivity(activity));
    this.after = this.getDelayedTransitions();
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
      this.definition,
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
    return new StateNode(this.definition, this.options, context);
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
      onEntry: this.onEntry,
      onExit: this.onExit,
      activities: this.activities || [],
      meta: this.meta,
      order: this.order || -1,
      data: this.data
    };
  }

  /**
   * The raw config used to create the machine.
   */
  public get config(): StateNodeConfig<TContext, TStateSchema, TEvent> {
    const { parent, ...config } = this._config;

    return config;
  }

  /**
   * The mapping of events to transitions.
   */
  public get on(): TransitionsDefinition<TContext, TEvent> {
    return this.formatTransitions();
  }

  /**
   * All the transitions that can be taken from this state node.
   */
  public get transitions(): Array<TransitionDefinition<TContext, TEvent>> {
    return flatten(
      keys(this.on).map(
        event => this.on[event] as Array<TransitionDefinition<TContext, TEvent>>
      )
    );
  }

  /**
   * All delayed transitions from the config.
   */
  private getDelayedTransitions(): Array<
    DelayedTransitionDefinition<TContext, TEvent>
  > {
    if (this.after) {
      return this.after;
    }

    const afterConfig = this.config.after;

    if (!afterConfig) {
      return [];
    }

    if (Array.isArray(afterConfig)) {
      return afterConfig.map((delayedTransition, i) => {
        const { delay } = delayedTransition;
        let delayRef: string | number;

        if (typeof delay === 'function') {
          delayRef = `${this.id}:delay[${i}]`;
          this.options.delays[delayRef] = delay; // TODO: util function
        } else {
          delayRef = delay;
        }

        const event = after(delayRef, this.id);

        this.onEntry.push(send(event, { delay }));
        this.onExit.push(cancel(event));

        return {
          event,
          ...delayedTransition,
          cond: delayedTransition.cond
            ? this.toGuard(delayedTransition.cond)
            : undefined,
          actions: toArray(delayedTransition.actions).map(action =>
            toActionObject(action)
          )
        };
      });
    }

    const allDelayedTransitions = flatten<
      DelayedTransitionDefinition<TContext, TEvent>
    >(
      keys(afterConfig).map(delayKey => {
        const delayedTransition = (afterConfig as Record<
          string,
          | TransitionConfig<TContext, TEvent>
          | Array<TransitionConfig<TContext, TEvent>>
        >)[delayKey];
        const delay = isNaN(+delayKey) ? delayKey : +delayKey;
        const event = after(delay, this.id);

        this.onEntry.push(send(event, { delay }));
        this.onExit.push(cancel(event));

        if (typeof delayedTransition === 'string') {
          return [{ target: delayedTransition, delay, event, actions: [] }];
        }

        const delayedTransitions = toArray(delayedTransition);

        return delayedTransitions.map(transition => ({
          event,
          delay,
          ...transition,
          cond: transition.cond ? this.toGuard(transition.cond) : undefined,
          actions: toArray(transition.actions).map(action =>
            toActionObject(action)
          )
        }));
      })
    );

    allDelayedTransitions.sort((a, b) =>
      typeof a === 'string' || typeof b === 'string' ? 0 : +a.delay - +b.delay
    );

    return allDelayedTransitions;
  }

  /**
   * Returns the state nodes represented by the current state value.
   *
   * @param state The state value or State instance
   */
  public getStateNodes(
    state: StateValue | State<TContext, TEvent>
  ): Array<StateNode<TContext>> {
    if (!state) {
      return [];
    }
    const stateValue =
      state instanceof State
        ? state.value
        : toStateValue(state, this.delimiter);

    if (typeof stateValue === 'string') {
      const initialStateValue = this.getStateNode(stateValue).initial;

      return initialStateValue !== undefined
        ? this.getStateNodes({ [stateValue]: initialStateValue } as StateValue)
        : [this.states[stateValue]];
    }

    const subStateKeys = keys(stateValue);
    const subStateNodes: Array<StateNode<TContext>> = subStateKeys.map(
      subStateKey => this.getStateNode(subStateKey)
    );

    return subStateNodes.concat(
      subStateKeys.reduce(
        (allSubStateNodes, subStateKey) => {
          const subStateNode = this.getStateNode(subStateKey).getStateNodes(
            stateValue[subStateKey]
          );

          return allSubStateNodes.concat(subStateNode);
        },
        [] as Array<StateNode<TContext>>
      )
    );
  }

  /**
   * Returns `true` if this state node explicitly handles the given event.
   *
   * @param event The event in question
   */
  public handles(event: Event<TEvent>): boolean {
    const eventType = getEventType<TEvent>(event);

    return this.events.indexOf(eventType) !== -1;
  }

  /**
   * Resolves the given `state` to a new `State` instance relative to this machine.
   *
   * This ensures that `.events` and `.nextEvents` represent the correct values.
   *
   * @param state The state to resolve
   */
  public resolveState(state: State<TContext, TEvent>): State<TContext, TEvent> {
    const tree = this.getStateTree(state.value);
    const value = this.resolve(state.value);

    return new State({
      value,
      context: state.context,
      event: state.event,
      historyValue: state.historyValue,
      history: state.history,
      actions: state.actions,
      activities: state.activities,
      meta: state.meta,
      events: state.events,
      tree
    });
  }

  private transitionLeafNode(
    stateValue: string,
    state: State<TContext, TEvent>,
    eventObject: OmniEventObject<TEvent>
  ): StateTransition<TContext, TEvent> {
    const stateNode = this.getStateNode(stateValue);
    const next = stateNode.next(state, eventObject);

    if (!next.tree) {
      const { reentryStates, actions, tree } = this.next(state, eventObject);

      return {
        tree,
        source: state,
        reentryStates,
        actions
      };
    }

    return next;
  }
  private transitionCompoundNode(
    stateValue: StateValueMap,
    state: State<TContext, TEvent>,
    eventObject: OmniEventObject<TEvent>
  ): StateTransition<TContext, TEvent> {
    const subStateKeys = keys(stateValue);

    const stateNode = this.getStateNode(subStateKeys[0]);
    const next = stateNode._transition(
      stateValue[subStateKeys[0]],
      state,
      eventObject
    );

    if (!next.tree) {
      const { reentryStates, actions, tree } = this.next(state, eventObject);

      return {
        tree,
        source: state,
        reentryStates,
        actions
      };
    }

    return next;
  }
  private transitionParallelNode(
    stateValue: StateValueMap,
    state: State<TContext, TEvent>,
    eventObject: OmniEventObject<TEvent>
  ): StateTransition<TContext, TEvent> {
    const noTransitionKeys: string[] = [];
    const transitionMap: Record<string, StateTransition<TContext, TEvent>> = {};

    keys(stateValue).forEach(subStateKey => {
      const subStateValue = stateValue[subStateKey];

      if (!subStateValue) {
        return;
      }

      const subStateNode = this.getStateNode(subStateKey);

      const next = subStateNode._transition(subStateValue, state, eventObject);

      if (!next.tree) {
        noTransitionKeys.push(subStateKey);
      }

      transitionMap[subStateKey] = next;
    });

    const willTransition = keys(transitionMap).some(
      key => transitionMap[key].tree !== undefined
    );

    if (!willTransition) {
      const { reentryStates, actions, tree } = this.next(state, eventObject);

      return {
        tree,
        source: state,
        reentryStates,
        actions
      };
    }

    const allTrees = keys(transitionMap)
      .map(key => transitionMap[key].tree)
      .filter(t => t !== undefined) as StateTree[];

    const combinedTree = allTrees.reduce((acc, t) => {
      return acc.combine(t);
    });

    const allPaths = combinedTree.paths;

    // External transition that escapes orthogonal region
    if (
      allPaths.length === 1 &&
      !matchesState(toStateValue(this.path, this.delimiter), combinedTree.value)
    ) {
      return {
        tree: combinedTree,
        source: state,
        reentryStates: keys(transitionMap)
          .map(key => transitionMap[key].reentryStates)
          .reduce<Set<StateNode<TContext>>>(
            (allReentryStates, reentryStates) => {
              if (!reentryStates) {
                return allReentryStates;
              }
              for (const reentryState of reentryStates) {
                allReentryStates.add(reentryState);
              }
              return allReentryStates;
            },
            new Set()
          ),
        actions: flatten(
          keys(transitionMap).map(key => {
            return transitionMap[key].actions;
          })
        )
      };
    }

    const allResolvedTrees = keys(transitionMap).map(key => {
      const transition = transitionMap[key];
      const subValue = path(this.path)(
        transition.tree ? transition.tree.value : state.value || state.value
      )[key];

      return new StateTree(this.getStateNode(key), subValue).absolute;
    });

    const finalCombinedTree = allResolvedTrees.reduce((acc, t) => {
      return acc.combine(t);
    });

    return {
      tree: finalCombinedTree,
      source: state,
      reentryStates: keys(transitionMap).reduce((allReentryStates, key) => {
        const { tree, reentryStates } = transitionMap[key];

        // If the event was not handled (no subStateValue),
        // machine should still be in state without reentry/exit.
        if (!tree || !reentryStates) {
          return allReentryStates;
        }

        return new Set([
          ...Array.from(allReentryStates),
          ...Array.from(reentryStates)
        ]);
      }, new Set<StateNode<TContext>>()),
      actions: flatten(
        keys(transitionMap).map(key => {
          return transitionMap[key].actions;
        })
      )
    };
  }
  private _transition(
    stateValue: StateValue,
    state: State<TContext, TEvent>,
    event: OmniEventObject<TEvent>
  ): StateTransition<TContext, TEvent> {
    // leaf node
    if (typeof stateValue === 'string') {
      return this.transitionLeafNode(stateValue, state, event);
    }

    // hierarchical node
    if (keys(stateValue).length === 1) {
      return this.transitionCompoundNode(stateValue, state, event);
    }

    // orthogonal node
    return this.transitionParallelNode(stateValue, state, event);
  }
  private next(
    state: State<TContext, TEvent>,
    eventObject: OmniEventObject<TEvent>
  ): StateTransition<TContext, TEvent> {
    const eventType = eventObject.type;
    const candidates: Array<TransitionDefinition<TContext, TEvent>> = this.on[
      eventType
    ];
    const actions: Array<ActionObject<TContext, TEvent>> = this.transient
      ? [{ type: actionTypes.nullEvent }]
      : [];

    if (!candidates || !candidates.length) {
      return {
        tree: undefined,
        source: state,
        reentryStates: undefined,
        actions
      };
    }

    let nextStateStrings: string[] = [];
    let selectedTransition: unknown;

    for (const candidate of candidates) {
      const { cond, in: stateIn } = candidate;
      const resolvedContext = state.context;

      const isInState = stateIn
        ? typeof stateIn === 'string' && isStateId(stateIn)
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

      if (
        (!cond ||
          this.evaluateGuard(cond, resolvedContext, eventObject, state)) &&
        isInState
      ) {
        nextStateStrings = toArray(candidate.target);
        actions.push(...toArray(candidate.actions));
        selectedTransition = candidate;
        break;
      }
    }

    // targetless transition
    if (selectedTransition && nextStateStrings.length === 0) {
      const tree = state.value
        ? this.machine.getStateTree(state.value)
        : undefined;
      return {
        tree,
        source: state,
        reentryStates: undefined,
        actions
      };
    }

    if (!selectedTransition && nextStateStrings.length === 0) {
      return {
        tree: undefined,
        source: state,
        reentryStates: undefined,
        actions
      };
    }

    const nextStateNodes = flatten(
      nextStateStrings.map(str =>
        this.getRelativeStateNodes(str, state.historyValue)
      )
    );

    const isInternal = !!(selectedTransition as TransitionDefinition<
      TContext,
      TEvent
    >).internal;

    const reentryNodes = isInternal
      ? []
      : flatten(nextStateNodes.map(n => this.nodesFromChild(n)));

    const trees = nextStateNodes.map(stateNode => stateNode.tree);
    const combinedTree = trees.reduce((acc, t) => {
      return acc.combine(t);
    });

    return {
      tree: combinedTree,
      source: state,
      reentryStates: new Set(reentryNodes),
      actions
    };
  }

  /**
   * The state tree represented by this state node.
   */
  private get tree(): StateTree {
    const stateValue = toStateValue(this.path, this.delimiter);

    return new StateTree(this.machine, stateValue);
  }
  private nodesFromChild(
    childStateNode: StateNode<TContext>
  ): Array<StateNode<TContext>> {
    if (childStateNode.escapes(this)) {
      return [];
    }

    const nodes: Array<StateNode<TContext>> = [];
    let marker: StateNode<TContext> | undefined = childStateNode;

    while (marker && marker !== this) {
      nodes.push(marker);
      marker = marker.parent;
    }
    nodes.push(this); // inclusive

    return nodes;
  }
  private getStateTree(stateValue: StateValue): StateTree {
    return new StateTree(this, stateValue);
  }

  /**
   * Whether the given state node "escapes" this state node. If the `stateNode` is equal to or the parent of
   * this state node, it does not escape.
   */
  private escapes(stateNode: StateNode): boolean {
    if (this === stateNode) {
      return false;
    }

    let parent = this.parent;

    while (parent) {
      if (parent === stateNode) {
        return false;
      }
      parent = parent.parent;
    }

    return true;
  }
  private evaluateGuard(
    guard: Guard<TContext, TEvent>,
    context: TContext,
    eventObject: OmniEventObject<TEvent>,
    state: State<TContext, TEvent>
  ): boolean {
    let condFn: ConditionPredicate<TContext, OmniEventObject<TEvent>>;
    const { guards } = this.machine.options;
    const guardMeta: GuardMeta<TContext, TEvent> = {
      state,
      cond: guard
    };

    // TODO: do not hardcode!
    if (guard.type === 'xstate.cond') {
      return (guard as GuardPredicate<TContext, TEvent>).predicate(
        context,
        eventObject,
        guardMeta
      );
    }

    if (!guards[guard.type]) {
      throw new Error(
        `Guard (condition) '${guard.type}' is not implemented on machine '${
          this.machine.id
        }'.`
      );
    }

    condFn = guards[guard.type];

    return condFn(context, eventObject, guardMeta);
  }

  private toGuard(
    condition: Condition<TContext, TEvent>
  ): Guard<TContext, TEvent> {
    if (typeof condition === 'string') {
      return {
        type: condition
      };
    }

    if (typeof condition === 'function') {
      return {
        type: 'xstate.cond',
        predicate: condition
      };
    }

    return condition;
  }

  private getActions(
    transition: StateTransition<TContext, TEvent>,
    prevState: State<TContext>
  ): Array<ActionObject<TContext, TEvent>> {
    const entryExitStates = transition.tree
      ? transition.tree.resolved.getEntryExitStates(
          this.getStateTree(prevState.value),
          transition.reentryStates ? transition.reentryStates : undefined
        )
      : { entry: [], exit: [] };
    const doneEvents = transition.tree
      ? transition.tree.getDoneEvents(new Set(entryExitStates.entry))
      : [];

    if (!transition.source) {
      entryExitStates.exit = [];

      // Ensure that root StateNode (machine) is entered
      entryExitStates.entry.unshift(this);
    }

    const entryStates = new Set(entryExitStates.entry);
    const exitStates = new Set(entryExitStates.exit);

    const [entryActions, exitActions] = [
      flatten(
        Array.from(entryStates).map(stateNode => {
          return [
            ...stateNode.activities.map(activity => start(activity)),
            ...stateNode.onEntry
          ];
        })
      ).concat(doneEvents.map(raise)),
      flatten(
        Array.from(exitStates).map(stateNode => [
          ...stateNode.onExit,
          ...stateNode.activities.map(activity => stop(activity))
        ])
      )
    ];

    const actions = exitActions
      .concat(transition.actions)
      .concat(entryActions)
      .map(action => this.resolveAction(action));

    return actions;
  }
  private resolveAction(
    action: Action<TContext, TEvent>
  ): ActionObject<TContext, TEvent> {
    return toActionObject(action, this.machine.options.actions);
  }
  private resolveActivity(
    activity: Activity<TContext, TEvent>
  ): ActivityDefinition<TContext, TEvent> {
    return toActivityDefinition(activity);
  }

  /**
   * Determines the next state given the current `state` and sent `event`.
   *
   * @param state The current State instance or state value
   * @param event The event that was sent at the current state
   * @param context The current context (extended state) of the current state
   */
  public transition(
    state: StateValue | State<TContext, TEvent>,
    event: OmniEvent<TEvent>,
    context?: TContext
  ): State<TContext, TEvent> {
    let currentState: State<TContext, TEvent>;

    if (state instanceof State) {
      currentState =
        context === undefined
          ? state
          : this.resolveState(State.from(state, context));
    } else {
      const resolvedStateValue =
        typeof state === 'string'
          ? this.resolve(pathToStateValue(this.getResolvedPath(state)))
          : this.resolve(state);
      const resolvedContext = context ? context : this.machine.context!;

      currentState = this.resolveState(
        State.from<TContext, TEvent>(resolvedStateValue, resolvedContext)
      );
    }

    const eventObject = toEventObject<OmniEventObject<TEvent>>(event);
    const eventType = eventObject.type;

    if (this.strict) {
      if (this.events.indexOf(eventType) === -1 && !isBuiltInEvent(eventType)) {
        throw new Error(
          `Machine '${this.id}' does not accept event '${eventType}'`
        );
      }
    }

    const stateTransition = this._transition(
      currentState.value,
      currentState,
      eventObject
    );

    const resolvedStateTransition: StateTransition<TContext, TEvent> = {
      ...stateTransition,
      tree: stateTransition.tree ? stateTransition.tree.resolved : undefined
    };

    return this.resolveTransition(
      resolvedStateTransition,
      currentState,
      eventObject
    );
  }
  private resolveTransition(
    stateTransition: StateTransition<TContext, TEvent>,
    currentState: State<TContext, TEvent>,
    eventObject: OmniEventObject<TEvent>
  ): State<TContext, TEvent> {
    const resolvedStateValue = stateTransition.tree
      ? stateTransition.tree.value
      : undefined;
    const historyValue = currentState.historyValue
      ? currentState.historyValue
      : stateTransition.source
      ? (this.machine.historyValue(currentState.value) as HistoryValue)
      : undefined;

    if (!IS_PRODUCTION && stateTransition.tree) {
      try {
        this.ensureValidPaths(stateTransition.tree.paths); // TODO: ensure code coverage for this
      } catch (e) {
        throw new Error(
          `Event '${
            eventObject ? eventObject.type : 'none'
          }' leads to an invalid configuration: ${e.message}`
        );
      }
    }

    const actions = this.getActions(stateTransition, currentState);
    const activities = { ...currentState.activities };
    actions.forEach(action => {
      if (action.type === actionTypes.start) {
        activities[action.activity!.type] = true;
      } else if (action.type === actionTypes.stop) {
        activities[action.activity!.type] = false;
      }
    });

    const [raisedEvents, otherActions] = partition(
      actions,
      (action): action is BuiltInEvent<TEvent> =>
        action.type === actionTypes.raise ||
        action.type === actionTypes.nullEvent
    );

    const [assignActions, nonEventActions] = partition(
      otherActions,
      (action): action is AssignAction<TContext, TEvent> =>
        action.type === actionTypes.assign
    );

    const updatedContext = assignActions.length
      ? this.options.updater(currentState.context, eventObject, assignActions)
      : currentState.context;

    const resolvedActions = nonEventActions.map(action => {
      const actionObject = toActionObject(action);
      if (actionObject.type === actionTypes.send) {
        const sendAction = resolveSend(
          actionObject as SendAction<TContext, TEvent>,
          updatedContext,
          eventObject || { type: ActionTypes.Init }
        ); // TODO: fix ActionTypes.Init

        if (typeof sendAction.delay === 'string') {
          if (
            !this.machine.options.delays ||
            this.machine.options.delays[sendAction.delay] === undefined
          ) {
            console.warn(
              `No delay reference for delay expression '${
                sendAction.delay
              }' was found on machine '${this.machine.id}'`
            );

            // Do not send anything
            return sendAction;
          }

          const delayExpr = this.machine.options.delays[sendAction.delay];
          sendAction.delay =
            typeof delayExpr === 'number'
              ? delayExpr
              : delayExpr(
                  updatedContext,
                  eventObject || { type: ActionTypes.Init }
                );
        }

        return sendAction;
      }

      return toActionObject(actionObject, this.options.actions);
    });

    const stateNodes = resolvedStateValue
      ? this.getStateNodes(resolvedStateValue)
      : [];

    const isTransient = stateNodes.some(stateNode => stateNode.transient);
    if (isTransient) {
      raisedEvents.push({ type: actionTypes.nullEvent });
    }

    const meta = [this, ...stateNodes].reduce((acc, stateNode) => {
      if (stateNode.meta !== undefined) {
        acc[stateNode.id] = stateNode.meta;
      }
      return acc;
    }, {});

    let nextState = resolvedStateValue
      ? new State<TContext, TEvent>({
          value: resolvedStateValue,
          context: updatedContext,
          event: eventObject || initEvent,
          historyValue: historyValue
            ? updateHistoryValue(historyValue, resolvedStateValue)
            : undefined,
          history: stateTransition.source ? currentState : undefined,
          actions: resolvedActions,
          activities,
          meta,
          events: raisedEvents as TEvent[],
          tree: stateTransition.tree
        })
      : undefined;

    if (!nextState) {
      nextState = new State({
        value: currentState.value,
        context: updatedContext,
        event: eventObject,
        historyValue: currentState.historyValue,
        history: currentState,
        actions: [],
        activities: currentState.activities,
        meta: currentState.meta,
        events: [],
        tree: currentState.tree
      });

      // Unchanged state is changed if its context is changed
      nextState.changed = !!assignActions.length;

      return nextState;
    }

    // Dispose of penultimate histories to prevent memory leaks
    const { history } = nextState;
    if (history) {
      delete history.history;
    }

    let maybeNextState = nextState;
    while (raisedEvents.length) {
      const currentActions = maybeNextState.actions;
      const raisedEvent = raisedEvents.shift()!;
      maybeNextState = this.transition(
        maybeNextState,
        raisedEvent.type === actionTypes.nullEvent
          ? NULL_EVENT
          : (raisedEvent as RaisedEvent<TEvent>).event,
        maybeNextState.context
      );
      // Save original event to state
      maybeNextState.event = eventObject;
      maybeNextState.actions.unshift(...currentActions);
    }

    // Detect if state changed
    const changed = history
      ? !!maybeNextState.actions.length ||
        !!assignActions.length ||
        typeof history.value !== typeof maybeNextState.value ||
        !stateValuesEqual(maybeNextState.value, history.value)
      : undefined;

    maybeNextState.changed = changed;

    // Preserve original history after raised events
    maybeNextState.historyValue = nextState.historyValue;
    maybeNextState.history = history;

    return maybeNextState;
  }

  private ensureValidPaths(paths: string[][]): void {
    const visitedParents = new Map<
      StateNode<TContext>,
      Array<StateNode<TContext>>
    >();

    const stateNodes = flatten(
      paths.map(_path => this.getRelativeStateNodes(_path))
    );

    outer: for (const stateNode of stateNodes) {
      let marker = stateNode;

      while (marker.parent) {
        if (visitedParents.has(marker.parent)) {
          if (marker.parent.type === 'parallel') {
            continue outer;
          }

          throw new Error(
            `State node '${stateNode.id}' shares parent '${
              marker.parent.id
            }' with state node '${visitedParents
              .get(marker.parent)!
              .map(a => a.id)}'`
          );
        }

        if (!visitedParents.get(marker.parent)) {
          visitedParents.set(marker.parent, [stateNode]);
        } else {
          visitedParents.get(marker.parent)!.push(stateNode);
        }

        marker = marker.parent;
      }
    }
  }

  /**
   * Returns the child state node from its relative `stateKey`, or throws.
   */
  public getStateNode(stateKey: string): StateNode<TContext> {
    if (isStateId(stateKey)) {
      return this.machine.getStateNodeById(stateKey);
    }

    if (!this.states) {
      throw new Error(
        `Unable to retrieve child state '${stateKey}' from '${
          this.id
        }'; no child states exist.`
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
  public getStateNodeById(stateId: string): StateNode<TContext> {
    const resolvedStateId = isStateId(stateId)
      ? stateId.slice(STATE_IDENTIFIER.length)
      : stateId;

    if (resolvedStateId === this.id) {
      return this;
    }

    const stateNode = this.machine.idMap[resolvedStateId];

    if (!stateNode) {
      throw new Error(
        `Substate '#${resolvedStateId}' does not exist on '${this.id}'`
      );
    }

    return stateNode;
  }

  /**
   * Returns the relative state node from the given `statePath`, or throws.
   *
   * @param statePath The string or string array relative path to the state node.
   */
  public getStateNodeByPath(statePath: string | string[]): StateNode<TContext> {
    const arrayStatePath = toStatePath(statePath, this.delimiter).slice();
    let currentStateNode: StateNode<TContext> = this;
    while (arrayStatePath.length) {
      const key = arrayStatePath.shift()!;
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
        if (typeof stateValue === 'string') {
          const subStateNode = this.getStateNode(stateValue);

          if (
            subStateNode.type === 'parallel' ||
            subStateNode.type === 'compound'
          ) {
            return { [stateValue]: subStateNode.initialStateValue! };
          }

          return stateValue;
        }
        if (!keys(stateValue).length) {
          return this.initialStateValue || {};
        }

        return mapValues(stateValue, (subStateValue, subStateKey) => {
          return subStateValue
            ? this.getStateNode(subStateKey).resolve(subStateValue)
            : EMPTY_OBJECT;
        });

      default:
        return stateValue || EMPTY_OBJECT;
    }
  }

  private get resolvedStateValue(): StateValue {
    const { key } = this;

    if (this.type === 'parallel') {
      return {
        [key]: mapFilterValues<StateNode<TContext>, StateValue>(
          this.states,
          stateNode => stateNode.resolvedStateValue[stateNode.key],
          stateNode => !(stateNode.type === 'history')
        )
      };
    }

    if (this.initial === undefined) {
      // If leaf node, value is just the state node's key
      return key;
    }

    if (!this.states[this.initial]) {
      throw new Error(`Initial state '${this.initial}' not found on '${key}'`);
    }

    return {
      [key]: this.states[this.initial].resolvedStateValue
    };
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
    if (this.__cache.initialState) {
      return this.__cache.initialState;
    }

    const initialStateValue = (this.type === 'parallel'
      ? mapFilterValues(
          this.states as Record<string, StateNode<TContext>>,
          state => state.initialStateValue || EMPTY_OBJECT,
          stateNode => !(stateNode.type === 'history')
        )
      : typeof this.resolvedStateValue === 'string'
      ? undefined
      : this.resolvedStateValue[this.key]) as StateValue;

    this.__cache.initialState = initialStateValue;

    return this.__cache.initialState;
  }

  public getInitialState(
    stateValue: StateValue,
    context: TContext = this.machine.context!
  ): State<TContext, TEvent> {
    const activityMap: ActivityMap = {};
    const actions: Array<ActionObject<TContext, TEvent>> = [];

    this.getStateNodes(stateValue).forEach(stateNode => {
      if (stateNode.onEntry) {
        actions.push(...stateNode.onEntry);
      }
      if (stateNode.activities) {
        stateNode.activities.forEach(activity => {
          activityMap[getEventType(activity)] = true;
          actions.push(start(activity));
        });
      }
    });

    const assignActions = actions.filter(
      action => typeof action === 'object' && action.type === actionTypes.assign
    ) as Array<AssignAction<TContext, TEvent>>;

    const updatedContext = this.options.updater(
      context,
      { type: ActionTypes.Init },
      assignActions
    );

    const initialNextState = new State<TContext, TEvent>({
      value: stateValue,
      context: updatedContext,
      event: initEvent,
      activities: activityMap
    });

    return initialNextState;
  }

  /**
   * The initial State instance, which includes all actions to be executed from
   * entering the initial state.
   */
  public get initialState(): State<TContext, TEvent> {
    const { initialStateValue } = this;

    if (!initialStateValue) {
      throw new Error(
        `Cannot retrieve initial state from simple state '${this.id}'.`
      );
    }

    const state = this.getInitialState(initialStateValue);
    return this.resolveTransition(
      {
        tree: this.getStateTree(initialStateValue),
        source: undefined,
        reentryStates: new Set(this.getStateNodes(initialStateValue)),
        actions: []
      },
      state,
      { type: ActionTypes.Init }
    );
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
      if (historyConfig.target && typeof historyConfig.target === 'string') {
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

  public getStates(stateValue: StateValue): Array<StateNode<TContext>> {
    if (typeof stateValue === 'string') {
      return [this.states[stateValue]];
    }

    const stateNodes: Array<StateNode<TContext>> = [];

    keys(stateValue).forEach(key => {
      stateNodes.push(...this.states[key].getStates(stateValue[key]));
    });

    return stateNodes;
  }

  /**
   * Returns the leaf nodes from a state path relative to this state node.
   *
   * @param relativeStateId The relative state path to retrieve the state nodes
   * @param history The previous state to retrieve history
   * @param resolve Whether state nodes should resolve to initial child state nodes
   */
  public getRelativeStateNodes(
    relativeStateId: string | string[],
    historyValue?: HistoryValue,
    resolve: boolean = true
  ): Array<StateNode<TContext>> {
    if (typeof relativeStateId === 'string' && isStateId(relativeStateId)) {
      const unresolvedStateNode = this.getStateNodeById(relativeStateId);

      return resolve
        ? unresolvedStateNode.type === 'history'
          ? unresolvedStateNode.resolveHistory(historyValue)
          : unresolvedStateNode.initialStateNodes
        : [unresolvedStateNode];
    }

    const statePath = toStatePath(relativeStateId, this.delimiter);

    const rootStateNode = this.parent || this;

    const unresolvedStateNodes = rootStateNode.getFromRelativePath(
      statePath,
      historyValue
    );

    if (!resolve) {
      return unresolvedStateNodes;
    }
    return flatten(
      unresolvedStateNodes.map(stateNode => stateNode.initialStateNodes)
    );
  }
  public get initialStateNodes(): Array<StateNode<TContext>> {
    if (this.type === 'atomic' || this.type === 'final') {
      return [this];
    }

    // Case when state node is compound but no initial state is defined
    if (this.type === 'compound' && !this.initial) {
      if (!IS_PRODUCTION) {
        // tslint:disable-next-line:no-console
        console.warn(`Compound state node '${this.id}' has no initial state.`);
      }
      return [this];
    }

    const initialStateNodePaths = toStatePaths(this.initialStateValue!);
    return flatten(
      initialStateNodePaths.map(initialPath =>
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
    relativePath: string[],
    historyValue?: HistoryValue
  ): Array<StateNode<TContext>> {
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
      return childStateNode.resolveHistory(historyValue);
    }

    if (!this.states[stateKey]) {
      throw new Error(
        `Child state '${stateKey}' does not exist on '${this.id}'`
      );
    }

    return this.states[stateKey].getFromRelativePath(
      childStatePath,
      historyValue
    );
  }

  private historyValue(
    relativeStateValue?: StateValue | undefined
  ): HistoryValue | undefined {
    if (!keys(this.states).length) {
      return undefined;
    }

    return {
      current: relativeStateValue || this.initialStateValue,
      states: mapFilterValues<StateNode<TContext>, HistoryValue | undefined>(
        this.states,
        (stateNode, key) => {
          if (!relativeStateValue) {
            return stateNode.historyValue();
          }

          const subStateValue =
            typeof relativeStateValue === 'string'
              ? undefined
              : relativeStateValue[key];

          return stateNode.historyValue(
            subStateValue || stateNode.initialStateValue
          );
        },
        stateNode => !stateNode.history
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
  ): Array<StateNode<TContext>> {
    if (this.type !== 'history') {
      return [this];
    }

    const parent = this.parent!;

    if (!historyValue) {
      return this.target
        ? flatten(
            toStatePaths(this.target).map(relativeChildPath =>
              parent.getFromRelativePath(relativeChildPath)
            )
          )
        : parent.initialStateNodes;
    }

    const subHistoryValue = nestedPath<HistoryValue>(parent.path, 'states')(
      historyValue
    ).current;

    if (typeof subHistoryValue === 'string') {
      return [parent.getStateNode(subHistoryValue)];
    }

    return flatten(
      toStatePaths(subHistoryValue!).map(subStatePath => {
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
      keys(this.states).map(stateKey => {
        return (this.states[stateKey] as StateNode<TContext>).stateIds;
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
      keys(states).forEach(stateId => {
        const state = states[stateId];
        if (state.states) {
          for (const event of state.events) {
            events.add(`${event}`);
          }
        }
      });
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
      keys(this.on).filter(key => {
        const transitions = this.on[key];
        return transitions.some(transition => {
          return !(
            !transition.target &&
            !transition.actions.length &&
            transition.internal
          );
        });
      })
    );

    return Array.from(events);
  }
  private formatTransition(
    target: string | Array<string | StateNode> | undefined,
    transitionConfig: TransitionConfig<TContext, TEvent> | undefined,
    event: string
  ): TransitionDefinition<TContext, TEvent> {
    let internal = transitionConfig ? transitionConfig.internal : undefined;

    // Check if there is no target (targetless)
    // An undefined transition signals that the state node should not transition from that event.
    if (target === undefined || target === TARGETLESS_KEY) {
      return {
        ...transitionConfig,
        actions: transitionConfig
          ? toArray(transitionConfig.actions).map(action =>
              toActionObject(action)
            )
          : [],
        cond: transitionConfig
          ? transitionConfig.cond
            ? this.toGuard(transitionConfig.cond)
            : undefined
          : undefined,
        target: undefined,
        internal: internal === undefined ? true : internal,
        event
      };
    }

    const targets = toArray(target);

    // Format targets to their full string path
    const formattedTargets = targets.map(_target => {
      if (_target instanceof StateNode) {
        return `#${_target.id}`;
      }

      const isInternalTarget =
        typeof _target === 'string' && _target[0] === this.delimiter;
      internal = internal === undefined ? isInternalTarget : internal;

      // If internal target is defined on machine,
      // do not include machine key on target
      if (isInternalTarget && !this.parent) {
        return _target.slice(1);
      }

      return isInternalTarget ? this.key + _target : `${_target}`;
    });

    return {
      ...transitionConfig,
      actions: transitionConfig
        ? toArray(transitionConfig.actions).map(action =>
            toActionObject(action)
          )
        : [],
      cond: transitionConfig
        ? transitionConfig.cond
          ? this.toGuard(transitionConfig.cond)
          : undefined
        : undefined,
      target: formattedTargets,
      internal,
      event
    };
  }
  private formatTransitions(): TransitionsDefinition<TContext, TEvent> {
    const onConfig = this.config.on || EMPTY_OBJECT;
    const doneConfig = this.config.onDone
      ? {
          [`${done(this.id)}`]: this.config.onDone
        }
      : undefined;
    const invokeConfig = this.invoke.reduce(
      (acc, invokeDef) => {
        if (invokeDef.onDone) {
          acc[doneInvoke(invokeDef.id)] = invokeDef.onDone;
        }
        if (invokeDef.onError) {
          acc[actionTypes.errorExecution] = invokeDef.onError;
        }
        return acc;
      },
      {} as any
    );
    const delayedTransitions = this.after;

    const formattedTransitions: TransitionsDefinition<
      TContext,
      TEvent
    > = mapValues(
      { ...onConfig, ...doneConfig, ...invokeConfig },
      (value, event) => {
        if (value === undefined) {
          return [{ target: undefined, event, actions: [], internal: true }];
        }

        if (Array.isArray(value)) {
          return value.map(targetTransitionConfig =>
            this.formatTransition(
              targetTransitionConfig.target,
              targetTransitionConfig,
              event
            )
          );
        }

        if (typeof value === 'string' || value instanceof StateNode) {
          return [this.formatTransition([value], undefined, event)];
        }

        if (!IS_PRODUCTION) {
          keys(value).forEach(key => {
            if (
              ['target', 'actions', 'internal', 'in', 'cond', 'event'].indexOf(
                key
              ) === -1
            ) {
              throw new Error(
                `State object mapping of transitions is deprecated. Check the config for event '${event}' on state '${
                  this.id
                }'.`
              );
            }
          });
        }

        return [
          this.formatTransition(
            (value as TransitionConfig<TContext, TEvent>).target,
            value,
            event
          )
        ];
      }
    ) as TransitionsDefinition<TContext, TEvent>;

    delayedTransitions.forEach(delayedTransition => {
      formattedTransitions[delayedTransition.event] =
        formattedTransitions[delayedTransition.event] || [];
      formattedTransitions[delayedTransition.event].push(
        delayedTransition as TransitionDefinition<
          TContext,
          TEvent | EventObject
        >
      );
    });

    return formattedTransitions;
  }
}

export { StateNode };
