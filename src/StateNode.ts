import {
  getEventType,
  toStatePath,
  toStateValue,
  mapValues,
  path,
  toStatePaths,
  pathsToStateValue,
  pathToStateValue,
  getActionType,
  flatten,
  mapFilterValues,
  nestedPath
} from './utils';
import {
  Event,
  StateValue,
  Transition,
  Action,
  SimpleOrCompoundStateNodeConfig,
  ParallelMachineConfig,
  EventType,
  StandardMachineConfig,
  TransitionConfig,
  ActivityMap,
  Activity,
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
  DefaultData,
  DefaultExtState,
  StateNodeDefinition,
  TransitionDefinition,
  AssignAction
} from './types';
import { matchesState } from './matchesState';
import { State } from './State';
import * as actionTypes from './actionTypes';
import { start, stop, toEventObject } from './actions';

const STATE_DELIMITER = '.';
const HISTORY_KEY = '$history';
const NULL_EVENT = '';
const STATE_IDENTIFIER = '#';
const TARGETLESS_KEY = '';

const isStateId = (str: string) => str[0] === STATE_IDENTIFIER;
const createDefaultOptions = <TExtState>(): MachineOptions<TExtState> => ({
  guards: {}
});

type StateNodeConfig<TExtState> = Readonly<
  | SimpleOrCompoundStateNodeConfig<TExtState>
  | StandardMachineConfig<TExtState>
  | ParallelMachineConfig<TExtState>
>;

class StateNode<TExtState = DefaultExtState, TData = DefaultData> {
  public key: string;
  public id: string;
  public path: string[];
  public initial?: string;
  public parallel: boolean;
  public transient: boolean;
  public states: Record<string, StateNode<TExtState>>;
  public history: false | 'shallow' | 'deep';
  public onEntry: Array<Action<TExtState>>;
  public onExit: Array<Action<TExtState>>;
  public activities?: Array<Activity<TExtState>>;
  public strict: boolean;
  public parent?: StateNode<TExtState>;
  public machine: StateNode<TExtState>;
  public data: TData;
  public delimiter: string;
  public order: number;

  private __cache = {
    events: undefined as EventType[] | undefined,
    relativeValue: new Map() as Map<StateNode<TExtState>, StateValue>,
    initialState: undefined as StateValue | undefined
  };

  private idMap: Record<string, StateNode<TExtState>> = {};

  constructor(
    private _config: StateNodeConfig<TExtState>,
    public options: Readonly<MachineOptions<TExtState>> = createDefaultOptions<
      TExtState
    >(),
    /**
     * The initial extended state
     */
    public extendedState?: Readonly<TExtState>
  ) {
    this.key = _config.key || '(machine)';
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
    this.parallel = !!_config.parallel;
    this.order = _config.order || -1;

    this.states = (_config.states
      ? mapValues<
          SimpleOrCompoundStateNodeConfig<TExtState>,
          StateNode<TExtState>
        >(_config.states, (stateConfig, key, _, i) => {
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
        })
      : {}) as Record<string, StateNode<TExtState>>;

    // History config
    this.history =
      _config.history === true ? 'shallow' : _config.history || false;

    // this.on = config.on ? this.formatTransitions(config.on) : {};
    this.transient = !!(_config.on && _config.on[NULL_EVENT]);
    this.strict = !!_config.strict;
    this.onEntry = _config.onEntry
      ? ([] as Array<Action<TExtState>>).concat(_config.onEntry as Action<
          TExtState
        >)
      : [];
    this.onExit = _config.onExit
      ? ([] as Array<Action<TExtState>>).concat(_config.onExit)
      : [];
    this.data = _config.data;
    this.activities = _config.activities;
  }
  public get definition(): StateNodeDefinition<TExtState, TData> {
    return {
      key: this.key,
      initial: this.initial,
      parallel: this.parallel,
      history: this.history,
      states: mapValues(this.states, state => state.definition),
      on: this.on,
      onEntry: this.onEntry,
      onExit: this.onExit,
      activities: this.activities,
      data: this.data,
      order: this.order || -1,
      id: this.id
    };
  }
  public get config(): Readonly<
    | SimpleOrCompoundStateNodeConfig<TExtState>
    | StandardMachineConfig<TExtState>
    | ParallelMachineConfig<TExtState>
  > {
    const { parent, ...config } = this._config;

    return config;
  }
  public get on(): Record<string, Array<TransitionDefinition<TExtState>>> {
    const { config } = this;
    return config.on ? this.formatTransitions(config.on) : {};
  }
  public getStateNodes(
    state: StateValue | State<TExtState>
  ): Array<StateNode<TExtState>> {
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
        ? this.getStateNodes({ [stateValue]: initialStateValue })
        : [this.states[stateValue]];
    }

    const subStateKeys = Object.keys(stateValue);
    const subStateNodes: Array<StateNode<TExtState>> = subStateKeys.map(
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
        [] as Array<StateNode<TExtState>>
      )
    );
  }
  public handles(event: Event): boolean {
    const eventType = getEventType(event);

    return this.events.indexOf(eventType) !== -1;
  }
  private _transitionLeafNode(
    stateValue: string,
    state: State<TExtState>,
    event: Event,
    extendedState?: TExtState
  ): StateTransition<TExtState> {
    const stateNode = this.getStateNode(stateValue);
    const next = stateNode._next(state, event, extendedState);

    if (!next.value) {
      const { value, entryExitStates, actions, paths } = this._next(
        state,
        event,
        extendedState
      );

      return {
        value,
        entryExitStates: {
          entry: entryExitStates ? entryExitStates.entry : new Set(),
          exit: new Set<StateNode<TExtState>>([
            stateNode,
            ...(entryExitStates
              ? Array.from(entryExitStates.exit)
              : ([] as Array<StateNode<TExtState>>))
          ])
        },
        actions,
        paths
      };
    }

    return next;
  }
  private _transitionHierarchicalNode(
    stateValue: StateValueMap,
    state: State<TExtState>,
    event: Event,
    extendedState?: TExtState
  ): StateTransition<TExtState> {
    const subStateKeys = Object.keys(stateValue);

    const stateNode = this.getStateNode(subStateKeys[0]);
    const next = stateNode._transition(
      stateValue[subStateKeys[0]],
      state,
      event,
      extendedState
    );

    if (!next.value) {
      const { value, entryExitStates, actions, paths } = this._next(
        state,
        event,
        extendedState
      );

      return {
        value,
        entryExitStates: {
          entry: entryExitStates ? entryExitStates.entry : new Set(),
          exit: new Set<StateNode<TExtState>>([
            ...(next.entryExitStates
              ? Array.from(next.entryExitStates.exit)
              : []),
            stateNode,
            ...(entryExitStates
              ? Array.from(entryExitStates.exit)
              : ([] as Array<StateNode<TExtState>>))
          ])
        },
        actions,
        paths
      };
    }

    return next;
  }
  private _transitionOrthogonalNode(
    stateValue: StateValueMap,
    state: State<TExtState>,
    event: Event,
    extendedState?: TExtState
  ): StateTransition<TExtState> {
    const noTransitionKeys: string[] = [];
    const transitionMap: Record<string, StateTransition<TExtState>> = {};

    Object.keys(stateValue).forEach(subStateKey => {
      const subStateValue = stateValue[subStateKey];

      if (!subStateValue) {
        return;
      }

      const next = this.getStateNode(subStateKey)._transition(
        subStateValue,
        state,
        event,
        extendedState
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
      const { value, entryExitStates, actions, paths } = this._next(
        state,
        event,
        extendedState
      );

      return {
        value,
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
      return {
        value: this.machine.resolve(pathsToStateValue(allPaths)),
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
            { entry: new Set(), exit: new Set() } as EntryExitStates<TExtState>
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
        { entry: new Set(), exit: new Set() } as EntryExitStates<TExtState>
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
    state: State<TExtState>,
    event: Event,
    extendedState?: TExtState
  ): StateTransition<TExtState> {
    // leaf node
    if (typeof stateValue === 'string') {
      return this._transitionLeafNode(stateValue, state, event, extendedState);
    }

    // hierarchical node
    if (Object.keys(stateValue).length === 1) {
      return this._transitionHierarchicalNode(
        stateValue,
        state,
        event,
        extendedState
      );
    }

    // orthogonal node
    return this._transitionOrthogonalNode(
      stateValue,
      state,
      event,
      extendedState
    );
  }
  private _next(
    state: State<TExtState>,
    event: Event,
    extendedState?: TExtState
  ): StateTransition<TExtState> {
    const eventType = getEventType(event);
    const candidates = this.on[eventType];
    const actions: Array<Action<TExtState>> = this.transient
      ? [{ type: actionTypes.null }]
      : [];

    if (!candidates || !candidates.length) {
      return {
        value: undefined,
        entryExitStates: undefined,
        actions,
        paths: []
      };
    }

    let nextStateStrings: string[] = [];
    let selectedTransition: TransitionConfig<TExtState>;

    for (const candidate of candidates) {
      const {
        cond,
        in: stateIn
        // actions: transitionActions
      } = candidate as TransitionConfig<TExtState>;
      const extendedStateObject = extendedState || ({} as TExtState);
      const eventObject = toEventObject(event);

      const isInState = stateIn
        ? matchesState(
            toStateValue(stateIn, this.delimiter),
            path(this.path.slice(0, -2))(state.value)
          )
        : true;

      if (
        (!cond ||
          this._evaluateCond(
            cond,
            extendedStateObject,
            eventObject,
            state.value
          )) &&
        isInState
      ) {
        nextStateStrings = Array.isArray(candidate.target)
          ? candidate.target
          : candidate.target
            ? [candidate.target]
            : [];
        actions.push(...(candidate.actions ? candidate.actions : [])); // TODO: fixme;
        selectedTransition = candidate;
        break;
      }
    }

    // targetless transition
    if (selectedTransition! && nextStateStrings.length === 0) {
      return {
        value: state.value,
        entryExitStates: undefined,
        actions,
        paths: []
      };
    }

    if (!selectedTransition! && nextStateStrings.length === 0) {
      return {
        value: undefined,
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
        const { entry, exit } = this._getEntryExitStates(
          nextStateNode,
          !!selectedTransition.internal
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
      { entry: new Set(), exit: new Set() } as EntryExitStates<TExtState>
    );

    return {
      value: this.machine.resolve(
        pathsToStateValue(
          flatten(
            nextStateStrings.map(str =>
              this.getRelativeStateNodes(str, state.historyValue).map(
                s => s.path
              )
            )
          )
        )
      ),
      entryExitStates,
      actions,
      paths: nextStatePaths
    };
  }
  private _getEntryExitStates(
    nextStateNode: StateNode<TExtState>,
    internal: boolean
  ): EntryExitStates<TExtState> {
    const entryExitStates = {
      entry: [] as Array<StateNode<TExtState>>,
      exit: [] as Array<StateNode<TExtState>>
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

    let marker: StateNode<TExtState> = parent;
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
  private _evaluateCond(
    condition: Condition<TExtState>,
    extendedState: TExtState,
    eventObject: EventObject,
    interimState: StateValue
  ): boolean {
    let condFn: ConditionPredicate<TExtState>;
    const { guards } = this.machine.options;

    if (typeof condition === 'string') {
      if (!guards || !guards[condition]) {
        throw new Error(
          `String condition '${condition}' is not defined on machine '${
            this.machine.id
          }'`
        );
      }

      condFn = guards[condition];
    } else {
      condFn = condition;
    }

    return condFn(extendedState, eventObject, interimState);
  }
  private _getActions(
    transition: StateTransition<TExtState>
  ): Array<Action<TExtState>> {
    const entryExitActions = {
      entry: transition.entryExitStates
        ? flatten(
            Array.from(transition.entryExitStates.entry).map(n => [
              ...n.onEntry,
              ...(n.activities
                ? n.activities.map(activity => start(activity))
                : [])
            ])
          )
        : [],
      exit: transition.entryExitStates
        ? flatten(
            Array.from(transition.entryExitStates.exit).map(n => [
              ...n.onExit,
              ...(n.activities
                ? n.activities.map(activity => stop(activity))
                : [])
            ])
          )
        : []
    };

    const actions = (entryExitActions.exit || [])
      .concat(transition.actions || [])
      .concat(entryExitActions.entry || [])
      .map(
        action =>
          typeof action === 'string' ? this.resolveAction(action) : action
      );

    return actions;
  }
  private resolveAction(actionType: string): Action<TExtState> {
    const { actions } = this.machine.options;

    return (actions ? actions[actionType] : actionType) || actionType;
  }
  private _getActivities(
    state: State<TExtState>,
    transition: StateTransition<TExtState>
  ): ActivityMap {
    if (!transition.entryExitStates) {
      return {};
    }

    const activityMap = { ...state.activities };

    Array.from(transition.entryExitStates.exit).forEach(stateNode => {
      if (!stateNode.activities) {
        return; // TODO: fixme
      }

      stateNode.activities.forEach(activity => {
        activityMap[getActionType(activity)] = false;
      });
    });

    Array.from(transition.entryExitStates.entry).forEach(stateNode => {
      if (!stateNode.activities) {
        return; // TODO: fixme
      }

      stateNode.activities.forEach(activity => {
        activityMap[getActionType(activity)] = true;
      });
    });

    return activityMap;
  }
  public transition(
    state: StateValue | State<TExtState>,
    event: Event,
    extendedState?: TExtState
  ): State<TExtState> {
    const resolvedStateValue =
      typeof state === 'string'
        ? this.resolve(pathToStateValue(this.getResolvedPath(state)))
        : state instanceof State
          ? state
          : this.resolve(state);
    const resolvedExtendedState =
      extendedState ||
      ((state instanceof State ? state.ext : undefined) as TExtState);
    const eventObject = toEventObject(event);

    const eventType = eventObject.type;

    if (this.strict) {
      if (this.events.indexOf(eventType) === -1) {
        throw new Error(
          `Machine '${this.id}' does not accept event '${eventType}'`
        );
      }
    }

    const currentState = State.from<TExtState>(
      resolvedStateValue,
      resolvedExtendedState
    );

    const historyValue =
      resolvedStateValue instanceof State
        ? resolvedStateValue.historyValue
          ? resolvedStateValue.historyValue
          : (this.machine.historyValue(
              resolvedStateValue.value
            ) as HistoryValue)
        : (this.machine.historyValue(resolvedStateValue) as HistoryValue);

    const stateTransition = this._transition(
      currentState.value,
      currentState,
      event,
      resolvedExtendedState
    );

    try {
      this.ensureValidPaths(stateTransition.paths);
    } catch (e) {
      throw new Error(
        `Event '${eventType}' leads to an invalid configuration: ` + e.message
      );
    }

    const actions = this._getActions(stateTransition);
    const activities = this._getActivities(currentState, stateTransition);

    const raisedEvents = actions.filter(
      action =>
        typeof action === 'object' &&
        (action.type === actionTypes.raise || action.type === actionTypes.null)
    ) as Array<ActionObject<TExtState>>;

    const nonEventActions = actions.filter(
      action =>
        typeof action !== 'object' ||
        (action.type !== actionTypes.raise &&
          action.type !== actionTypes.null &&
          action.type !== actionTypes.assign)
    );
    const assignActions = actions.filter(
      action => typeof action === 'object' && action.type === actionTypes.assign
    ) as Array<AssignAction<TExtState>>;

    const updatedExtendedState = resolvedExtendedState
      ? assignActions.reduce((acc, assignAction) => {
          const { assignment } = assignAction;

          let partialUpdate: Partial<TExtState> = {};

          if (typeof assignment === 'function') {
            partialUpdate = assignment(acc, eventObject);
          } else {
            Object.keys(assignment).forEach(key => {
              const propAssignment = assignment[key];

              partialUpdate[key] =
                typeof propAssignment === 'function'
                  ? propAssignment(acc, eventObject)
                  : propAssignment;
            });
          }

          return Object.assign({}, acc, partialUpdate);
        }, resolvedExtendedState)
      : resolvedExtendedState;

    const stateNodes = stateTransition.value
      ? this.getStateNodes(stateTransition.value)
      : [];

    const isTransient = stateNodes.some(stateNode => stateNode.transient);
    if (isTransient) {
      raisedEvents.push({ type: actionTypes.null });
    }

    const data = stateNodes.reduce((acc, stateNode) => {
      acc[stateNode.id] = stateNode.data;
      return acc;
    }, {});

    const nextState = stateTransition.value
      ? new State<TExtState>(
          stateTransition.value,
          updatedExtendedState,
          StateNode.updateHistoryValue(historyValue, stateTransition.value),
          currentState,
          nonEventActions,
          activities,
          data,
          raisedEvents
        )
      : undefined;

    if (!nextState) {
      // Unchanged state should be returned with no actions
      return State.inert<TExtState>(currentState, updatedExtendedState);
    }

    // Dispose of previous histories to prevent memory leaks
    delete currentState.history;

    let maybeNextState = nextState;
    while (raisedEvents.length) {
      const currentActions = maybeNextState.actions;
      const raisedEvent = raisedEvents.shift()!;
      maybeNextState = this.transition(
        maybeNextState,
        raisedEvent.type === actionTypes.null ? NULL_EVENT : raisedEvent.event,
        maybeNextState.ext
      );
      maybeNextState.actions.unshift(...currentActions);
    }

    return maybeNextState;
  }
  private ensureValidPaths(paths: string[][]): void {
    const visitedParents = new Map<
      StateNode<TExtState>,
      Array<StateNode<TExtState>>
    >();

    const stateNodes = flatten(
      paths.map(_path => this.getRelativeStateNodes(_path))
    );

    outer: for (const stateNode of stateNodes) {
      let marker = stateNode;

      while (marker.parent) {
        if (visitedParents.has(marker.parent)) {
          if (marker.parent.parallel) {
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
  public getStateNode(stateKey: string): StateNode<TExtState> {
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
  public getStateNodeById(stateId: string): StateNode<TExtState> {
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
  public getStateNodeByPath(
    statePath: string | string[]
  ): StateNode<TExtState> {
    const arrayStatePath = toStatePath(statePath, this.delimiter);
    let currentStateNode: StateNode<TExtState> = this;
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

    if (this.parallel) {
      return mapValues(
        this.initialStateValue as Record<string, StateValue>,
        (subStateValue, subStateKey) => {
          return subStateValue
            ? this.getStateNode(subStateKey).resolve(
                stateValue[subStateKey] || subStateValue
              )
            : {};
        }
      );
    }

    return mapValues(stateValue, (subStateValue, subStateKey) => {
      return subStateValue
        ? this.getStateNode(subStateKey).resolve(subStateValue)
        : {};
    });
  }

  private get resolvedStateValue(): StateValue {
    const { key } = this;

    if (this.parallel) {
      return {
        [key]: mapFilterValues(
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

    const initialStateValue = (this.parallel
      ? mapFilterValues(
          this.states as Record<string, StateNode<TExtState>>,
          state => state.initialStateValue || {},
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
    extendedState: TExtState = this.machine.extendedState!
  ): State<TExtState> {
    const activityMap: ActivityMap = {};
    const actions: Array<Action<TExtState>> = [];

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

    // TODO: deduplicate - DRY (from this.transition())
    const raisedEvents = actions.filter(
      action =>
        typeof action === 'object' &&
        (action.type === actionTypes.raise || action.type === actionTypes.null)
    ) as Array<ActionObject<TExtState>>;

    const assignActions = actions.filter(
      action => typeof action === 'object' && action.type === actionTypes.assign
    ) as Array<AssignAction<TExtState>>;

    const updatedExtendedState = extendedState
      ? assignActions.reduce((acc, assignAction) => {
          const { assignment } = assignAction;

          let partialUpdate: Partial<TExtState> = {};

          if (typeof assignment === 'function') {
            partialUpdate = assignment(acc, { type: 'init' });
          } else {
            Object.keys(assignment).forEach(key => {
              const propAssignment = assignment[key];

              partialUpdate[key] =
                typeof propAssignment === 'function'
                  ? propAssignment(acc, { type: 'init' })
                  : propAssignment;
            });
          }

          return Object.assign({}, acc, partialUpdate);
        }, extendedState)
      : extendedState;

    const initialNextState = new State<TExtState>(
      stateValue,
      updatedExtendedState,
      undefined,
      undefined,
      actions,
      activityMap,
      undefined,
      []
    );

    return raisedEvents.reduce((nextState, raisedEvent) => {
      const currentActions = nextState.actions;
      nextState = this.transition(
        nextState,
        raisedEvent.type === actionTypes.null ? NULL_EVENT : raisedEvent.event,
        nextState.ext
      );
      nextState.actions.unshift(...currentActions);
      return nextState;
    }, initialNextState);
  }
  public get initialState(): State<TExtState> {
    const { initialStateValue } = this;

    if (!initialStateValue) {
      throw new Error(
        `Cannot retrieve initial state from simple state '${this.id}.'`
      );
    }

    return this.getState(initialStateValue);
  }
  public get target(): StateValue | undefined {
    let target;
    if (this.history) {
      const historyConfig = this.config as HistoryStateNodeConfig<TExtState>;
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
  public getStates(stateValue: StateValue): Array<StateNode<TExtState>> {
    if (typeof stateValue === 'string') {
      return [this.states[stateValue]];
    }

    const stateNodes: Array<StateNode<TExtState>> = [];

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
  ): Array<StateNode<TExtState>> {
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
  public get initialStateNodes(): Array<StateNode<TExtState>> {
    // todo - isLeafNode or something
    if (!this.parallel && !this.initial) {
      return [this];
    }

    const { initialState } = this;
    const initialStateNodePaths = toStatePaths(initialState.value);
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
  ): Array<StateNode<TExtState>> {
    if (!relativePath.length) {
      return [this];
    }

    const [x, ...xs] = relativePath;

    if (!this.states) {
      throw new Error(
        `Cannot retrieve subPath '${x}' from node with no states`
      );
    }

    // TODO: remove (4.0)
    if (x === HISTORY_KEY) {
      if (!historyValue) {
        return [this];
      }

      const subHistoryValue = nestedPath<HistoryValue>(this.path, 'states')(
        historyValue
      ).current;

      if (typeof subHistoryValue === 'string') {
        return this.states[subHistoryValue].getFromRelativePath(
          xs,
          historyValue
        );
      }

      return flatten(
        Object.keys(subHistoryValue!).map(key => {
          return this.states[key].getFromRelativePath(xs, historyValue);
        })
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
      states: mapFilterValues(
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
  ): Array<StateNode<TExtState>> {
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
        return this.states[stateKey].stateIds;
      })
    );
    return [this.id].concat(childStateIds);
  }
  public get events(): EventType[] {
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
    transitionConfig: TransitionConfig<TExtState> | undefined,
    event: string
  ): TransitionDefinition<TExtState> {
    let internal = transitionConfig ? transitionConfig.internal : false;

    // Check if there is no target (targetless)
    // An undefined transition signals that the state node should not transition from that event.
    if (target === undefined || target === TARGETLESS_KEY) {
      return {
        ...transitionConfig,
        target: undefined,
        internal: true,
        event
      };
    }

    const targets = Array.isArray(target) ? target : [target];

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
      target: formattedTargets,
      internal,
      event
    };
  }
  private formatTransitions(
    onConfig: Record<string, Transition<TExtState> | undefined>
  ): Record<string, Array<TransitionDefinition<TExtState>>> {
    return mapValues(onConfig, (value, event) => {
      if (value === undefined) {
        return [];
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

      return Object.keys(value).map(target => {
        return this.formatTransition(target, value[target], event);
      });
    });
  }
}

export { StateNode };
