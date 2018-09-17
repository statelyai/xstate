import {
  getEventType,
  toStatePath,
  toStateValue,
  mapValues,
  path,
  toStatePaths,
  pathsToStateValue,
  pathToStateValue,
  flatten,
  mapFilterValues,
  nestedPath,
  toArray
} from './utils';
import {
  Event,
  StateValue,
  Action,
  TransitionConfig,
  ActivityMap,
  EntryExitStates,
  StateTransition,
  ActionObject,
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
  StateNodeValueTree,
  StateSchema,
  TransitionsDefinition,
  StatesDefinition,
  StateNodesConfig,
  ActionTypes,
  AnyEvent,
  RaisedEvent
} from './types';
import { matchesState } from './matchesState';
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
  done,
  raise
  // done
} from './actions';

const STATE_DELIMITER = '.';
const NULL_EVENT = '';
const STATE_IDENTIFIER = '#';
const TARGETLESS_KEY = '';

const EMPTY_OBJECT = {};
const EMPTY_ARRAY = [];

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
        : _config.states && Object.keys(_config.states).length
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

    // this.on = config.on ? this.formatTransitions(config.on) : {};
    this.transient = !!(_config.on && _config.on[NULL_EVENT]);
    this.strict = !!_config.strict;
    this.onEntry = toArray(_config.onEntry);
    this.onExit = toArray(_config.onExit);
    this.data = _config.data;
    this.activities = toArray(_config.activities).map(activity =>
      this.resolveActivity(activity)
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
      after: this.after,
      activities: this.activities || EMPTY_ARRAY,
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
  public get after(): Array<DelayedTransitionDefinition<TContext, TEvents>> {
    const {
      config: { after: afterConfig }
    } = this;

    if (!afterConfig) {
      return EMPTY_ARRAY;
    }

    if (Array.isArray(afterConfig)) {
      return afterConfig.map(delayedTransition => ({
        event: after(delayedTransition.delay, this.id),
        ...delayedTransition,
        actions: toArray(delayedTransition.actions)
      }));
    }

    const allDelayedTransitions = flatten(
      Object.keys(afterConfig).map(delayKey => {
        const delayedTransition = (afterConfig as Record<
          number | string,
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

    const subStateKeys = Object.keys(stateValue);
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

    if (!next.value) {
      const { value, entryExitStates, actions, paths } = this.next(
        state,
        eventObject,
        context
      );

      return {
        value,
        tree: value ? this.machine.getStateNodeValueTree(value) : undefined,
        source: state,
        entryExitStates: {
          entry: entryExitStates ? entryExitStates.entry : new Set(),
          exit: new Set<StateNode<TContext>>([
            stateNode,
            ...(entryExitStates
              ? Array.from(entryExitStates.exit)
              : ([] as Array<StateNode<TContext>>))
          ])
        },
        actions,
        paths
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
    const subStateKeys = Object.keys(stateValue);

    const stateNode = this.getStateNode(subStateKeys[0]);
    const next = stateNode._transition(
      stateValue[subStateKeys[0]],
      state,
      eventObject,
      context
    );

    if (!next.value) {
      const { value, entryExitStates, actions, paths } = this.next(
        state,
        eventObject,
        context
      );

      return {
        value,
        tree: value ? this.machine.getStateNodeValueTree(value) : undefined,
        source: state,
        entryExitStates: {
          entry: entryExitStates ? entryExitStates.entry : new Set(),
          exit: new Set<StateNode<TContext>>([
            ...(next.entryExitStates
              ? Array.from(next.entryExitStates.exit)
              : []),
            stateNode,
            ...(entryExitStates
              ? Array.from(entryExitStates.exit)
              : ([] as Array<StateNode<TContext>>))
          ])
        },
        actions,
        paths
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

    Object.keys(stateValue).forEach(subStateKey => {
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

      if (!next.value) {
        noTransitionKeys.push(subStateKey);
      }

      transitionMap[subStateKey] = next;
    });

    const willTransition = Object.keys(transitionMap).some(
      key => transitionMap[key].value !== undefined
    );

    if (!willTransition) {
      const { value, entryExitStates, actions, paths } = this.next(
        state,
        eventObject,
        context
      );

      return {
        value,
        tree: value ? this.machine.getStateNodeValueTree(value) : undefined,
        source: state,
        entryExitStates: {
          entry: entryExitStates ? entryExitStates.entry : new Set(),
          exit: new Set([
            ...Object.keys(this.states).map(key => this.states[key]),
            ...(entryExitStates ? Array.from(entryExitStates.exit) : [])
          ])
        },
        actions,
        paths
      };
    }

    const allPaths = flatten(
      Object.keys(transitionMap).map(key => transitionMap[key].paths)
    );

    // External transition that escapes orthogonal region
    if (
      allPaths.length === 1 &&
      !matchesState(pathToStateValue(this.path), pathToStateValue(allPaths[0]))
    ) {
      const value = this.machine.resolve(pathsToStateValue(allPaths));

      return {
        value,
        tree: value ? this.machine.getStateNodeValueTree(value) : undefined,
        source: state,
        entryExitStates: Object.keys(transitionMap)
          .map(key => transitionMap[key].entryExitStates)
          .reduce(
            (allEntryExitStates, entryExitStates) => {
              const { entry, exit } = entryExitStates!;

              return {
                entry: new Set([
                  ...Array.from(allEntryExitStates!.entry),
                  ...Array.from(entry)
                ]),
                exit: new Set([
                  ...Array.from(allEntryExitStates!.exit),
                  ...Array.from(exit)
                ])
              };
            },
            { entry: new Set(), exit: new Set() } as EntryExitStates<TContext>
          ),
        actions: flatten(
          Object.keys(transitionMap).map(key => {
            return transitionMap[key].actions;
          })
        ),
        paths: allPaths
      };
    }

    const allResolvedPaths = flatten(
      Object.keys(transitionMap).map(key => {
        const transition = transitionMap[key];
        const value = transition.value || state.value;

        return toStatePaths(path(this.path)(value)[key]).map(statePath =>
          this.path.concat(key, statePath)
        );
      })
    );

    const nextStateValue = this.machine.resolve(
      pathsToStateValue(allResolvedPaths)
    );

    return {
      value: nextStateValue,
      tree: nextStateValue
        ? this.machine.getStateNodeValueTree(nextStateValue)
        : undefined,
      source: state,
      entryExitStates: Object.keys(transitionMap).reduce(
        (allEntryExitStates, key) => {
          const { value: subStateValue, entryExitStates } = transitionMap[key];

          // If the event was not handled (no subStateValue),
          // machine should still be in state without reentry/exit.
          if (!subStateValue || !entryExitStates) {
            return allEntryExitStates;
          }

          const { entry, exit } = entryExitStates;

          return {
            entry: new Set([
              ...Array.from(allEntryExitStates.entry),
              ...Array.from(entry)
            ]),
            exit: new Set([
              ...Array.from(allEntryExitStates.exit),
              ...Array.from(exit)
            ])
          };
        },
        { entry: new Set(), exit: new Set() } as EntryExitStates<TContext>
      ),
      actions: flatten(
        Object.keys(transitionMap).map(key => {
          return transitionMap[key].actions;
        })
      ),
      paths: toStatePaths(nextStateValue)
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
    if (Object.keys(stateValue).length === 1) {
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
        value: undefined,
        tree: undefined,
        source: state,
        entryExitStates: undefined,
        actions,
        paths: []
      };
    }

    let nextStateStrings: string[] = [];
    let selectedTransition: unknown;

    for (const candidate of candidates) {
      const {
        cond,
        in: stateIn
        // actions: transitionActions
      } = candidate as TransitionConfig<TContext, TEvents>;
      const resolvedContext = context || (EMPTY_OBJECT as TContext);

      const isInState = stateIn
        ? matchesState(
            toStateValue(stateIn, this.delimiter),
            path(this.path.slice(0, -2))(state.value)
          )
        : true;

      if (
        (!cond ||
          this.evaluateCond(cond, resolvedContext, eventObject, state.value)) &&
        isInState
      ) {
        nextStateStrings = toArray(candidate.target);
        actions.push(...toArray(candidate.actions));
        selectedTransition = candidate;
        break;
      }
    }

    // targetless transition
    if (selectedTransition! && nextStateStrings.length === 0) {
      return {
        value: state.value,
        tree: state.value
          ? this.machine.getStateNodeValueTree(state.value)
          : undefined,
        source: state,
        entryExitStates: undefined,
        actions,
        paths: []
      };
    }

    if (!selectedTransition! && nextStateStrings.length === 0) {
      return {
        value: undefined,
        tree: undefined,
        source: state,
        entryExitStates: undefined,
        actions,
        paths: []
      };
    }

    const nextStateNodes = flatten(
      nextStateStrings.map(str =>
        this.getRelativeStateNodes(str, state.historyValue)
      )
    );

    const nextStatePaths = nextStateNodes.map(stateNode => stateNode.path);

    const entryExitStates = nextStateNodes.reduce(
      (allEntryExitStates, nextStateNode) => {
        const { entry, exit } = this.getEntryExitStates(
          nextStateNode,
          !!(selectedTransition as TransitionDefinition<TContext, TEvents>)
            .internal
        );

        return {
          entry: new Set([
            ...Array.from(allEntryExitStates.entry),
            ...Array.from(entry)
          ]),
          exit: new Set([
            ...Array.from(allEntryExitStates.exit),
            ...Array.from(exit)
          ])
        };
      },
      { entry: new Set(), exit: new Set() } as EntryExitStates<TContext>
    );

    const value = this.machine.resolve(
      pathsToStateValue(
        flatten(
          nextStateStrings.map(str =>
            this.getRelativeStateNodes(str, state.historyValue).map(s => s.path)
          )
        )
      )
    );

    return {
      value,
      tree: value ? this.machine.getStateNodeValueTree(value) : undefined,
      source: state,
      entryExitStates,
      actions,
      paths: nextStatePaths
    };
  }
  private getStateNodeValueTree(stateValue: StateValue): StateNodeValueTree {
    if (typeof stateValue === 'string') {
      const childStateNode = this.getStateNode(stateValue);
      return {
        stateNode: this,
        done: childStateNode.type === 'final',
        value: {
          [stateValue]: {
            stateNode: this.getStateNode(stateValue),
            value: undefined,
            done: childStateNode.type === 'final'
          }
        }
      };
    }

    const value = mapValues(stateValue, (subValue, key) => {
      return this.getStateNode(key).getStateNodeValueTree(subValue);
    });

    return {
      stateNode: this,
      value,
      done: Object.keys(value).every(key => value[key].done)
    };
  }
  private getEntryExitStates(
    nextStateNode: StateNode<TContext>,
    internal: boolean
  ): EntryExitStates<TContext> {
    const entryExitStates = {
      entry: [] as Array<StateNode<TContext>>,
      exit: [] as Array<StateNode<TContext>>
    };

    const fromPath = this.path;
    const toPath = nextStateNode.path;

    let parent = this.machine;

    for (let i = 0; i < Math.min(fromPath.length, toPath.length); i++) {
      const fromPathSegment = fromPath[i];
      const toPathSegment = toPath[i];

      if (fromPathSegment === toPathSegment) {
        parent = parent.getStateNode(fromPathSegment);
      } else {
        break;
      }
    }

    const commonAncestorPath = parent.path;

    let marker: StateNode<TContext> = parent;
    for (const segment of fromPath.slice(commonAncestorPath.length)) {
      marker = marker.getStateNode(segment);
      entryExitStates.exit.unshift(marker);
    }

    // Child node
    if (parent === this) {
      if (!internal) {
        entryExitStates.exit.push(this);
        entryExitStates.entry.push(this);
      }
    }

    marker = parent;
    for (const segment of toPath.slice(commonAncestorPath.length)) {
      marker = marker.getStateNode(segment);
      entryExitStates.entry.push(marker);
    }

    return {
      entry: new Set(entryExitStates.entry),
      exit: new Set(entryExitStates.exit)
    };
  }
  private evaluateCond(
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
      new Set(this.after.map(delayedTransition => delayedTransition.delay))
    );

    return delays.map(delay => ({
      id: this.id,
      delay
    }));
  }
  private getActions(
    transition: StateTransition<TContext>
  ): Array<Action<TContext>> {
    const doneEvents: Set<string> = new Set();
    const entryExitActions = {
      entry: transition.entryExitStates
        ? flatten(
            Array.from(transition.entryExitStates.entry).map(stateNode => {
              if (stateNode.type === 'final') {
                const stateTree = this.getStateNodeValueTree(transition.value!);
                doneEvents.add(done(stateNode.id));
                const grandparent = stateNode.parent
                  ? stateNode.parent.parent
                  : undefined;

                if (grandparent) {
                  const grandparentPath = grandparent.path;
                  const grandparentTree = nestedPath(grandparentPath, 'value')(
                    stateTree
                  ) as StateNodeValueTree;

                  if (grandparentTree.done) {
                    doneEvents.add(done(grandparentTree.stateNode.id));
                  }
                }
              }

              return [
                ...stateNode.onEntry,
                ...stateNode.activities.map(activity => start(activity)),
                ...stateNode.delays.map(({ delay, id }) =>
                  send(after(delay, id), { delay })
                )
              ];
            })
          ).concat(Array.from(doneEvents).map(raise))
        : [],
      exit: transition.entryExitStates
        ? flatten(
            Array.from(transition.entryExitStates.exit).map(stateNode => [
              ...stateNode.onExit,
              ...stateNode.activities.map(activity => stop(activity)),
              ...stateNode.delays.map(({ delay, id }) =>
                cancel(after(delay, id))
              )
            ])
          )
        : []
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
    const { activities } = this.machine.options;

    if (typeof activity === 'string') {
      return toActivityDefinition(
        activities ? { type: activity, ...activities[activity] } : activity
      );
    }

    return activity;
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

    return this.resolveTransition(stateTransition, currentState, eventObject);
  }
  private resolveTransition(
    stateTransition: StateTransition<TContext>,
    currentState: State<TContext, TEvents>,
    event?: TEvents
  ): State<TContext, TEvents> {
    const historyValue = currentState.historyValue
      ? currentState.historyValue
      : stateTransition.source
        ? (this.machine.historyValue(currentState.value) as HistoryValue)
        : undefined;

    if (!IS_PRODUCTION) {
      try {
        this.ensureValidPaths(stateTransition.paths);
      } catch (e) {
        throw new Error(
          `Event '${
            event ? event.type : 'none'
          }' leads to an invalid configuration: ${e.message}`
        );
      }
    }

    const actions = this.getActions(stateTransition);
    const activities = this.getActivities(
      stateTransition.entryExitStates,
      currentState.activities
    );

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

    const updatedContext = currentState.context
      ? assignActions.reduce((acc, assignAction) => {
          const { assignment } = assignAction;

          let partialUpdate: Partial<TContext> = {};

          if (typeof assignment === 'function') {
            partialUpdate = assignment(
              acc,
              event || ({ type: ActionTypes.Init } as TEvents)
            );
          } else {
            Object.keys(assignment).forEach(key => {
              const propAssignment = assignment[key];

              partialUpdate[key] =
                typeof propAssignment === 'function'
                  ? propAssignment(acc, event)
                  : propAssignment;
            });
          }

          return Object.assign({}, acc, partialUpdate);
        }, currentState.context)
      : currentState.context;

    const stateNodes = stateTransition.value
      ? this.getStateNodes(stateTransition.value)
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

    const nextState = stateTransition.value
      ? new State<TContext, TEvents>(
          stateTransition.value,
          updatedContext,
          historyValue
            ? StateNode.updateHistoryValue(historyValue, stateTransition.value)
            : undefined,
          stateTransition.source ? currentState : undefined,
          toActionObjects(nonEventActions, this.options.actions),
          activities,
          data,
          raisedEvents as TEvents[]
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
  private resolve(stateValue: StateValue): StateValue {
    if (typeof stateValue === 'string') {
      const subStateNode = this.getStateNode(stateValue);
      return subStateNode.initial
        ? { [stateValue]: subStateNode.initialStateValue! }
        : stateValue;
    }

    if (this.type === 'parallel') {
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
    }

    return mapValues(stateValue, (subStateValue, subStateKey) => {
      return subStateValue
        ? this.getStateNode(subStateKey).resolve(subStateValue)
        : EMPTY_OBJECT;
    });
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
      // @ts-ignore TODO: fixme
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
  public getState(
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

    // TODO: deduplicate - DRY (from this.transition())
    const raisedEvents = actions.filter(
      action =>
        typeof action === 'object' &&
        (action.type === actionTypes.raise || action.type === actionTypes.null)
    ) as Array<ActionObject<TContext>>;

    const assignActions = actions.filter(
      action => typeof action === 'object' && action.type === actionTypes.assign
    ) as Array<AssignAction<TContext, TEvents>>;

    const updatedContext = context
      ? assignActions.reduce((acc, assignAction) => {
          const { assignment } = assignAction;

          let partialUpdate: Partial<TContext> = {};

          if (typeof assignment === 'function') {
            partialUpdate = assignment(acc, { type: 'init' } as TEvents); // TODO: fix init
          } else {
            Object.keys(assignment).forEach(key => {
              const propAssignment = assignment[key];

              partialUpdate[key] =
                typeof propAssignment === 'function'
                  ? propAssignment(acc, { type: 'init' }) // TODO: fix init
                  : propAssignment;
            });
          }

          return Object.assign({}, acc, partialUpdate);
        }, context)
      : context;

    const initialNextState = new State<TContext, TEvents>(
      stateValue,
      updatedContext,
      undefined,
      undefined,
      toActionObjects(actions, this.options.actions),
      activityMap,
      undefined,
      []
    );

    return raisedEvents.reduce((nextState, raisedEvent) => {
      const currentActions = nextState.actions;
      nextState = this.transition(
        nextState,
        raisedEvent.type === actionTypes.null ? NULL_EVENT : raisedEvent.event,
        nextState.context
      );
      nextState.actions.unshift(...currentActions);
      return nextState;
    }, initialNextState);
  }
  public get initialState(): State<TContext, TEvents> {
    const { initialStateValue } = this;

    if (!initialStateValue) {
      throw new Error(
        `Cannot retrieve initial state from simple state '${this.id}'.`
      );
    }

    const state = this.getState(initialStateValue);
    return this.resolveTransition(
      {
        value: state.value,
        tree: state.value
          ? this.machine.getStateNodeValueTree(state.value)
          : undefined,
        source: undefined,
        entryExitStates: {
          entry: new Set(this.getStateNodes(state.value)),
          exit: new Set()
        },
        actions: [],
        paths: []
      },
      state
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

    Object.keys(stateValue).forEach(key => {
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
    if (!Object.keys(this.states).length) {
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
      Object.keys(this.states).map(stateKey => {
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
    const events = new Set(Object.keys(this.on));

    if (states) {
      Object.keys(states).forEach(stateId => {
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
    const delayedTransitions = this.after;

    const formattedTransitions: TransitionsDefinition<
      TContext,
      TEvents
    > = mapValues(onConfig, (value, event) => {
      if (value === undefined) {
        return [{ target: undefined, event, actions: [] }];
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
        Object.keys(value).forEach(key => {
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
