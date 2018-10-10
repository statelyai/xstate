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
  keys
} from './utils';
import {
  Event,
  StateValue,
  Action,
  TransitionConfig,
  ActivityMap,
  EntryExitStates,
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
  Delay,
  StateTypes,
  StateNodeConfig,
  Activity,
  StateSchema,
  TransitionsDefinition,
  StatesDefinition,
  StateNodesConfig,
  ActionTypes,
  AnyEvent,
  RaisedEvent
} from './types';
import { matchesState } from './utils';
import { State } from './State';
import * as actionTypes from './actionTypes';
import {
  start,
  stop,
  toEventObject,
  toActionObjects,
  toActivityDefinition,
  send,
  cancel,
  after,
  raise,
  done
} from './actions';
import { StateTree } from './StateTree';

const STATE_DELIMITER = '.';
const NULL_EVENT = '';
const STATE_IDENTIFIER = '#';
const TARGETLESS_KEY = '';

const EMPTY_OBJECT = {};

const isStateId = (str: string) => str[0] === STATE_IDENTIFIER;
const createDefaultOptions = <TContext>(): MachineOptions<TContext, any> => ({
  guards: EMPTY_OBJECT
});

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

class StateNode<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvents extends AnyEvent<EventObject> = AnyEvent<EventObject>
> {
  public key: string;
  public id: string;
  public type: StateTypes;
  public path: string[];
  public initial?: keyof TStateSchema['states'];
  public parallel: boolean;
  public transient: boolean;
  public states: StateNodesConfig<TContext, TStateSchema, TEvents>;
  public history: false | 'shallow' | 'deep';
  public onEntry: Array<Action<TContext>>;
  public onExit: Array<Action<TContext>>;
  public activities: Array<ActivityDefinition<TContext>>;
  public strict: boolean;
  public parent?: StateNode<TContext>;
  public machine: StateNode<TContext>;
  public data?: TStateSchema extends { data: infer D } ? D : any;
  public delimiter: string;
  public order: number;

  private __cache = {
    events: undefined as Array<TEvents['type']> | undefined,
    relativeValue: new Map() as Map<StateNode<TContext>, StateValue>,
    initialState: undefined as StateValue | undefined
  };

  private idMap: Record<string, StateNode<TContext>> = {};

  constructor(
    private _config: StateNodeConfig<TContext, TStateSchema, TEvents>,
    public options: Readonly<
      MachineOptions<TContext, TEvents>
    > = createDefaultOptions<TContext>(),
    /**
     * The initial extended state
     */
    public context?: Readonly<TContext>
  ) {
    this.key = _config.key || _config.id || '(machine)';
    this.type =
      _config.type ||
      (_config.parallel // TODO: deprecate
        ? 'parallel'
        : _config.states && keys(_config.states).length
          ? 'compound'
          : _config.history
            ? 'history'
            : 'atomic');
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
    this.initial = _config.initial;
    this.order = _config.order || -1;

    this.states = (_config.states
      ? mapValues(
          _config.states,
          (stateConfig: StateNodeConfig<TContext, any, TEvents>, key, _, i) => {
            const stateNode = new StateNode({
              ...stateConfig,
              key,
              order: stateConfig.order === undefined ? stateConfig.order : i,
              parent: this
            });
            Object.assign(this.idMap, {
              [stateNode.id]: stateNode,
              ...stateNode.idMap
            });
            return stateNode;
          }
        )
      : EMPTY_OBJECT) as StateNodesConfig<TContext, TStateSchema, TEvents>;

    // History config
    this.history =
      _config.history === true ? 'shallow' : _config.history || false;

    this.transient = !!(_config.on && _config.on[NULL_EVENT]);
    this.strict = !!_config.strict;
    this.onEntry = toArray(_config.onEntry);
    this.onExit = toArray(_config.onExit);
    this.data = _config.data;
    this.activities = toArray(_config.activities).map(activity =>
      this.resolveActivity(activity)
    );
  }
  public withConfig(
    options: MachineOptions<TContext, TEvents>,
    context?: TContext
  ): StateNode<TContext, TStateSchema, TEvents> {
    return new StateNode(
      this.definition,
      {
        actions: { ...this.options.actions, ...options.actions },
        activities: { ...this.options.activities, ...options.activities },
        guards: { ...this.options.guards, ...options.guards }
      },
      context
    );
  }
  public get definition(): StateNodeDefinition<
    TContext,
    TStateSchema,
    TEvents
  > {
    return {
      id: this.id,
      key: this.key,
      type: this.type,
      initial: this.initial,
      history: this.history,
      states: mapValues(
        this.states,
        (state: StateNode<TContext, any, TEvents>) => state.definition
      ) as StatesDefinition<TContext, TStateSchema, TEvents>,
      on: this.on,
      onEntry: this.onEntry,
      onExit: this.onExit,
      activities: this.activities || [],
      data: this.data,
      order: this.order || -1
    };
  }
  public get config(): StateNodeConfig<TContext, TStateSchema, TEvents> {
    const { parent, ...config } = this._config;

    return config;
  }
  public get on(): TransitionsDefinition<TContext, TEvents> {
    return this.formatTransitions();
  }
  public get transitions(): Array<TransitionDefinition<TContext, TEvents>> {
    return flatten(
      keys(this.on).map(
        event =>
          this.on[event] as Array<TransitionDefinition<TContext, TEvents>>
      )
    );
  }
  public get after(): Array<DelayedTransitionDefinition<TContext, TEvents>> {
    const {
      config: { after: afterConfig }
    } = this;

    if (!afterConfig) {
      return [];
    }

    if (Array.isArray(afterConfig)) {
      return afterConfig.map(delayedTransition => ({
        event: after(delayedTransition.delay, this.id),
        ...delayedTransition,
        actions: toArray(delayedTransition.actions)
      }));
    }

    const allDelayedTransitions = flatten(
      keys(afterConfig).map(delayKey => {
        const delayedTransition = (afterConfig as Record<
          string,
          | TransitionConfig<TContext, TEvents>
          | Array<TransitionConfig<TContext, TEvents>>
        >)[delayKey];
        const delay = +delayKey;
        const event = after(delay, this.id);

        if (typeof delayedTransition === 'string') {
          return [{ target: delayedTransition, delay, event, actions: [] }];
        }

        const delayedTransitions = toArray(delayedTransition);

        return delayedTransitions.map(transition => ({
          event,
          delay,
          ...transition,
          actions: toArray(transition.actions)
        }));
      })
    );

    allDelayedTransitions.sort((a, b) => a.delay - b.delay);

    return allDelayedTransitions;
  }
  public getStateNodes(
    state: StateValue | State<TContext, TEvents>
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

      return initialStateValue
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
  public handles(event: Event<TEvents>): boolean {
    const eventType = getEventType<TEvents>(event);

    return this.events.indexOf(eventType) !== -1;
  }
  private transitionLeafNode(
    stateValue: string,
    state: State<TContext, TEvents>,
    eventObject: TEvents,
    context?: TContext
  ): StateTransition<TContext> {
    const stateNode = this.getStateNode(stateValue);
    const next = stateNode.next(state, eventObject, context);

    if (!next.tree) {
      const { reentryStates, actions, tree } = this.next(
        state,
        eventObject,
        context
      );

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
    state: State<TContext, TEvents>,
    eventObject: TEvents,
    context?: TContext
  ): StateTransition<TContext> {
    const subStateKeys = keys(stateValue);

    const stateNode = this.getStateNode(subStateKeys[0]);
    const next = stateNode._transition(
      stateValue[subStateKeys[0]],
      state,
      eventObject,
      context
    );

    if (!next.tree) {
      const { reentryStates, actions, tree } = this.next(
        state,
        eventObject,
        context
      );

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
    state: State<TContext, TEvents>,
    eventObject: TEvents,
    context?: TContext
  ): StateTransition<TContext> {
    const noTransitionKeys: string[] = [];
    const transitionMap: Record<string, StateTransition<TContext>> = {};

    keys(stateValue).forEach(subStateKey => {
      const subStateValue = stateValue[subStateKey];

      if (!subStateValue) {
        return;
      }

      const subStateNode = this.getStateNode(subStateKey);

      const next = subStateNode._transition(
        subStateValue,
        state,
        eventObject,
        context
      );

      if (!next.tree) {
        noTransitionKeys.push(subStateKey);
      }

      transitionMap[subStateKey] = next;
    });

    const willTransition = keys(transitionMap).some(
      key => transitionMap[key].tree !== undefined
    );

    if (!willTransition) {
      const { reentryStates, actions, tree } = this.next(
        state,
        eventObject,
        context
      );

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
          .reduce((allReentryStates, reentryStates) => {
            return new Set([
              ...Array.from(allReentryStates || []),
              ...Array.from(reentryStates || [])
            ]);
          }, new Set<StateNode<TContext>>()),
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
  public _transition(
    stateValue: StateValue,
    state: State<TContext, TEvents>,
    event: TEvents,
    context?: TContext
  ): StateTransition<TContext> {
    // leaf node
    if (typeof stateValue === 'string') {
      return this.transitionLeafNode(stateValue, state, event, context);
    }

    // hierarchical node
    if (keys(stateValue).length === 1) {
      return this.transitionCompoundNode(stateValue, state, event, context);
    }

    // orthogonal node
    return this.transitionParallelNode(stateValue, state, event, context);
  }
  private next(
    state: State<TContext, TEvents>,
    eventObject: TEvents,
    context?: TContext
  ): StateTransition<TContext> {
    const eventType = eventObject.type;
    const candidates = this.on[eventType];
    const actions: Array<Action<TContext>> = this.transient
      ? [{ type: actionTypes.null }]
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
      const { cond, in: stateIn } = candidate as TransitionConfig<
        TContext,
        TEvents
      >;
      const resolvedContext = context || (EMPTY_OBJECT as TContext);

      const isInState = stateIn
        ? matchesState(
            toStateValue(stateIn, this.delimiter),
            path(this.path.slice(0, -2))(state.value)
          )
        : true;

      if (
        (!cond ||
          this.evaluateGuard(
            cond,
            resolvedContext,
            eventObject,
            state.value
          )) &&
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
      TEvents
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
    condition: Condition<TContext, TEvents>,
    context: TContext,
    eventObject: TEvents,
    interimState: StateValue
  ): boolean {
    let condFn: ConditionPredicate<TContext, TEvents>;
    const { guards } = this.machine.options;

    if (typeof condition === 'string') {
      if (!guards || !guards[condition]) {
        throw new Error(
          `Condition '${condition}' is not implemented on machine '${
            this.machine.id
          }'.`
        );
      }

      condFn = guards[condition];
    } else {
      condFn = condition;
    }

    return condFn(context, eventObject, interimState);
  }
  public get delays(): Delay[] {
    const delays = Array.from(
      new Set(
        this.transitions
          .map(transition => transition.delay)
          .filter<number>((delay => delay !== undefined) as (
            delay: number | undefined
          ) => delay is number)
      )
    );

    return delays.map(delay => ({
      id: this.id,
      delay
    }));
  }
  private getActions(
    transition: StateTransition<TContext>,
    prevState: State<TContext>
  ): Array<Action<TContext>> {
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
    }

    const entryExitActions = {
      entry: flatten(
        Array.from(new Set(entryExitStates.entry)).map(stateNode => {
          return [
            ...stateNode.onEntry,
            ...stateNode.activities.map(activity => start(activity)),
            ...stateNode.delays.map(({ delay, id }) =>
              send(after(delay, id), { delay })
            )
          ];
        })
      ).concat(doneEvents.map(raise)),
      exit: flatten(
        Array.from(new Set(entryExitStates.exit)).map(stateNode => [
          ...stateNode.onExit,
          ...stateNode.activities.map(activity => stop(activity)),
          ...stateNode.delays.map(({ delay, id }) => cancel(after(delay, id)))
        ])
      )
    };

    const actions = entryExitActions.exit
      .concat(transition.actions)
      .concat(entryExitActions.entry)
      .map(
        action =>
          typeof action === 'string' ? this.resolveAction(action) : action
      );

    return actions;
  }
  private resolveAction(actionType: string): Action<TContext> {
    const { actions } = this.machine.options;

    return (actions ? actions[actionType] : actionType) || actionType;
  }
  private resolveActivity(
    activity: Activity<TContext>
  ): ActivityDefinition<TContext> {
    // const { activities } = this.machine.options;

    const activityDefinition = toActivityDefinition(activity);

    return activityDefinition;
  }
  private getActivities(
    entryExitStates?: EntryExitStates<TContext>,
    activities?: ActivityMap
  ): ActivityMap {
    if (!entryExitStates) {
      return EMPTY_OBJECT;
    }

    const activityMap = { ...activities };

    Array.from(entryExitStates.exit).forEach(stateNode => {
      if (!stateNode.activities) {
        return; // TODO: fixme
      }

      stateNode.activities.forEach(activity => {
        activityMap[activity.type] = false;
      });
    });

    Array.from(entryExitStates.entry).forEach(stateNode => {
      if (!stateNode.activities) {
        return; // TODO: fixme
      }

      stateNode.activities.forEach(activity => {
        activityMap[activity.type] = true;
      });
    });

    return activityMap;
  }
  public transition(
    state: StateValue | State<TContext, TEvents>,
    event: Event<TEvents>,
    context?: TContext
  ): State<TContext, TEvents> {
    const resolvedStateValue =
      typeof state === 'string'
        ? this.resolve(pathToStateValue(this.getResolvedPath(state)))
        : state instanceof State
          ? state
          : this.resolve(state);
    const resolvedContext =
      context ||
      ((state instanceof State ? state.context : undefined) as TContext);
    const eventObject = toEventObject(event);
    const eventType = eventObject.type;

    if (this.strict) {
      if (this.events.indexOf(eventType) === -1) {
        throw new Error(
          `Machine '${this.id}' does not accept event '${eventType}'`
        );
      }
    }

    const currentState = State.from<TContext, TEvents>(
      resolvedStateValue,
      resolvedContext
    );

    const stateTransition = this._transition(
      currentState.value,
      currentState,
      eventObject,
      resolvedContext
    );

    const resolvedStateTransition: StateTransition<TContext> = {
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
    stateTransition: StateTransition<TContext>,
    currentState: State<TContext, TEvents>,
    event?: TEvents
  ): State<TContext, TEvents> {
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
            event ? event.type : 'none'
          }' leads to an invalid configuration: ${e.message}`
        );
      }
    }

    const actions = this.getActions(stateTransition, currentState);
    const entryExitStates = stateTransition.tree
      ? stateTransition.tree.getEntryExitStates(
          this.getStateTree(currentState.value)
        )
      : { entry: [], exit: [] };
    const activities = stateTransition.tree
      ? this.getActivities(
          {
            entry: new Set(entryExitStates.entry),
            exit: new Set(entryExitStates.exit)
          },
          currentState.activities
        )
      : {};

    const raisedEvents = actions.filter(
      action =>
        typeof action === 'object' &&
        (action.type === actionTypes.raise || action.type === actionTypes.null)
    ) as Array<RaisedEvent<TEvents> | { type: ActionTypes.Null }>;

    const nonEventActions = actions.filter(
      action =>
        typeof action !== 'object' ||
        (action.type !== actionTypes.raise &&
          action.type !== actionTypes.null &&
          action.type !== actionTypes.assign)
    );
    const assignActions = actions.filter(
      action => typeof action === 'object' && action.type === actionTypes.assign
    ) as Array<AssignAction<TContext, TEvents>>;

    const updatedContext = StateNode.updateContext(
      currentState.context,
      event,
      assignActions
    );

    const stateNodes = resolvedStateValue
      ? this.getStateNodes(resolvedStateValue)
      : [];

    const isTransient = stateNodes.some(stateNode => stateNode.transient);
    if (isTransient) {
      raisedEvents.push({ type: actionTypes.null });
    }

    const data = [this, ...stateNodes].reduce((acc, stateNode) => {
      if (stateNode.data !== undefined) {
        acc[stateNode.id] = stateNode.data;
      }
      return acc;
    }, {});

    const nextState = resolvedStateValue
      ? new State<TContext, TEvents>(
          resolvedStateValue,
          updatedContext,
          historyValue
            ? StateNode.updateHistoryValue(historyValue, resolvedStateValue)
            : undefined,
          stateTransition.source ? currentState : undefined,
          toActionObjects(nonEventActions, this.options.actions),
          activities,
          data,
          raisedEvents as TEvents[],
          stateTransition.tree
        )
      : undefined;

    if (!nextState) {
      // Unchanged state should be returned with no actions
      return State.inert<TContext, TEvents>(currentState, updatedContext);
    }

    // Dispose of penultimate histories to prevent memory leaks
    if (currentState.history) {
      delete currentState.history.history;
    }

    let maybeNextState = nextState;
    while (raisedEvents.length) {
      const currentActions = maybeNextState.actions;
      const raisedEvent = raisedEvents.shift()!;
      maybeNextState = this.transition(
        maybeNextState,
        raisedEvent.type === actionTypes.null
          ? NULL_EVENT
          : (raisedEvent as RaisedEvent<TEvents>).event,
        maybeNextState.context
      );
      maybeNextState.actions.unshift(...currentActions);
    }

    return maybeNextState;
  }
  public static updateContext<TContext, TEvents extends EventObject>(
    context: TContext,
    event: TEvents | undefined,
    assignActions: Array<AssignAction<TContext, TEvents>>
  ): TContext {
    const updatedContext = context
      ? assignActions.reduce((acc, assignAction) => {
          const { assignment } = assignAction;

          let partialUpdate: Partial<TContext> = {};

          if (typeof assignment === 'function') {
            partialUpdate = assignment(
              acc,
              event || ({ type: ActionTypes.Init } as TEvents)
            );
          } else {
            keys(assignment).forEach(key => {
              const propAssignment = assignment[key];

              partialUpdate[key] =
                typeof propAssignment === 'function'
                  ? propAssignment(acc, event)
                  : propAssignment;
            });
          }

          return Object.assign({}, acc, partialUpdate);
        }, context)
      : context;

    return updatedContext;
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
  public getStateNodeByPath(statePath: string | string[]): StateNode<TContext> {
    const arrayStatePath = toStatePath(statePath, this.delimiter);
    let currentStateNode: StateNode<TContext> = this;
    while (arrayStatePath.length) {
      const key = arrayStatePath.shift()!;
      currentStateNode = currentStateNode.getStateNode(key);
    }

    return currentStateNode;
  }
  public resolve(stateValue: StateValue): StateValue {
    if (!stateValue) {
      return this.initialStateValue || EMPTY_OBJECT; // TODO: type-specific properties
    }

    switch (this.type) {
      case 'parallel':
        const r = mapValues(
          this.initialStateValue as Record<string, StateValue>,
          (subStateValue, subStateKey) => {
            const sv = subStateValue
              ? this.getStateNode(subStateKey).resolve(
                  stateValue[subStateKey] || subStateValue
                )
              : EMPTY_OBJECT;

            return sv;
          }
        );

        return r;

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
          stateNode => !stateNode.history
        )
      };
    }

    if (!this.initial) {
      // If leaf node, value is just the state node's key
      return key;
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
          stateNode => !stateNode.history
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
  ): State<TContext, TEvents> {
    const activityMap: ActivityMap = {};
    const actions: Array<Action<TContext>> = [];

    this.getStateNodes(stateValue).forEach(stateNode => {
      if (stateNode.onEntry) {
        actions.push(...stateNode.onEntry);
      }
      if (stateNode.activities) {
        stateNode.activities.forEach(activity => {
          activityMap[getEventType(activity) as string] = true; // TODO: fixme
          actions.push(start(activity));
        });
      }
    });

    const assignActions = actions.filter(
      action => typeof action === 'object' && action.type === actionTypes.assign
    ) as Array<AssignAction<TContext, TEvents>>;

    const updatedContext = StateNode.updateContext(
      context,
      undefined,
      assignActions
    );

    const initialNextState = new State<TContext, TEvents>(
      stateValue,
      updatedContext,
      undefined,
      undefined,
      undefined,
      activityMap,
      undefined,
      []
    );

    return initialNextState;
  }
  public get initialState(): State<TContext, TEvents> {
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
      undefined
    );
  }
  public get target(): StateValue | undefined {
    let target;
    if (this.history) {
      const historyConfig = this.config as HistoryStateNodeConfig<
        TContext,
        TEvents
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
        ? unresolvedStateNode.history
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
        console.warn(`Compound state node '${this.id}' has no initial state.`);
      }
      return [this];
    }

    const { initialStateValue } = this;
    const initialStateNodePaths = toStatePaths(initialStateValue!);
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

    const [x, ...xs] = relativePath;

    if (!this.states) {
      throw new Error(
        `Cannot retrieve subPath '${x}' from node with no states`
      );
    }

    const childStateNode = this.getStateNode(x);

    if (childStateNode.history) {
      return childStateNode.resolveHistory(historyValue);
    }

    if (!this.states[x]) {
      throw new Error(`Child state '${x}' does not exist on '${this.id}'`);
    }

    return this.states[x].getFromRelativePath(xs, historyValue);
  }
  public static updateHistoryValue(
    hist: HistoryValue,
    stateValue: StateValue
  ): HistoryValue {
    function update(
      _hist: HistoryValue,
      _sv: StateValue
    ): Record<string, HistoryValue | undefined> {
      return mapValues(_hist.states, (subHist, key) => {
        if (!subHist) {
          return undefined;
        }
        const subStateValue =
          (typeof _sv === 'string' ? undefined : _sv[key]) ||
          (subHist ? subHist.current : undefined);

        if (!subStateValue) {
          return undefined;
        }

        return {
          current: subStateValue,
          states: update(subHist, subStateValue)
        };
      });
    }
    return {
      current: stateValue,
      states: update(hist, stateValue)
    };
  }
  public historyValue(
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
    if (!this.history) {
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
        : this.parent!.initialStateNodes;
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
  public get stateIds(): string[] {
    const childStateIds = flatten(
      keys(this.states).map(stateKey => {
        return (this.states[stateKey] as StateNode<TContext>).stateIds;
      })
    );
    return [this.id].concat(childStateIds);
  }
  public get events(): Array<TEvents['type']> {
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
  public get ownEvents(): Array<TEvents['type']> {
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
    target: string | string[] | undefined,
    transitionConfig: TransitionConfig<TContext, TEvents> | undefined,
    event: string
  ): TransitionDefinition<TContext, TEvents> {
    let internal = transitionConfig ? transitionConfig.internal : false;

    // Check if there is no target (targetless)
    // An undefined transition signals that the state node should not transition from that event.
    if (target === undefined || target === TARGETLESS_KEY) {
      return {
        ...transitionConfig,
        actions: transitionConfig ? toArray(transitionConfig.actions) : [],
        target: undefined,
        internal: transitionConfig
          ? transitionConfig.internal === undefined
            ? true
            : transitionConfig.internal
          : true,
        event
      };
    }

    const targets = toArray(target);

    // Format targets to their full string path
    const formattedTargets = targets.map(_target => {
      const internalTarget =
        typeof _target === 'string' && _target[0] === this.delimiter;
      internal = internal || internalTarget;

      // If internal target is defined on machine,
      // do not include machine key on target
      if (internalTarget && !this.parent) {
        return _target.slice(1);
      }

      return internalTarget ? this.key + _target : _target;
    });

    return {
      ...transitionConfig,
      actions: transitionConfig ? toArray(transitionConfig.actions) : [],
      target: formattedTargets,
      internal,
      event
    };
  }
  private formatTransitions(): TransitionsDefinition<TContext, TEvents> {
    const onConfig = this.config.on || EMPTY_OBJECT;
    const doneConfig = this.config.onDone
      ? {
          [done(this.id)]: this.config.onDone
        }
      : undefined;
    const delayedTransitions = this.after;

    const formattedTransitions: TransitionsDefinition<
      TContext,
      TEvents
    > = mapValues({ ...onConfig, ...doneConfig }, (value, event) => {
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

      if (typeof value === 'string') {
        return [this.formatTransition([value], undefined, event)];
      }

      if (!IS_PRODUCTION) {
        keys(value).forEach(key => {
          if (
            ['target', 'actions', 'internal', 'in', 'cond'].indexOf(key) === -1
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
          (value as TransitionConfig<TContext, TEvents>).target,
          value,
          event
        )
      ];
    }) as TransitionsDefinition<TContext, TEvents>;

    delayedTransitions.forEach(delayedTransition => {
      formattedTransitions[delayedTransition.event] =
        formattedTransitions[delayedTransition.event] || [];
      formattedTransitions[delayedTransition.event].push(
        delayedTransition as TransitionDefinition<
          TContext,
          TEvents | EventObject
        >
      );
    });

    return formattedTransitions;
  }
}

export { StateNode };
