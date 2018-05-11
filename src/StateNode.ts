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
  flatMap
} from './utils';
import {
  Event,
  StateValue,
  Transition,
  Action,
  Machine,
  StandardMachine,
  ParallelMachine,
  SimpleOrCompoundStateNodeConfig,
  MachineConfig,
  ParallelMachineConfig,
  EventType,
  StandardMachineConfig,
  TransitionConfig,
  ActivityMap,
  StateNodeConfig,
  Activity,
  ConditionalTransitionConfig,
  EntryExitStates,
  TargetTransitionConfig,
  _StateTransition,
  ActionObject,
  StateValueMap
} from './types';
import { matchesState } from './matchesState';
import { State } from './State';
import { start, stop, toEventObject, actionTypes } from './actions';

const STATE_DELIMITER = '.';
const HISTORY_KEY = '$history';
const NULL_EVENT = '';
const STATE_IDENTIFIER = '#';
const isStateId = (str: string) => str[0] === STATE_IDENTIFIER;
// const emptyActions: ActionMap = Object.freeze({
//   onEntry: [],
//   onExit: [],
//   actions: []
// });

class StateNode implements StateNodeConfig {
  public key: string;
  public id: string;
  public path: string[];
  public initial?: string;
  public parallel?: boolean;
  public states: Record<string, StateNode>;
  public on: Record<string, ConditionalTransitionConfig>;
  public onEntry: Action[];
  public onExit: Action[];
  public activities?: Activity[];
  public strict: boolean;
  public parent?: StateNode;
  public machine: StateNode;
  public data: object | undefined;
  public delimiter: string;

  private __cache = {
    events: undefined as EventType[] | undefined,
    relativeValue: new Map() as Map<StateNode, StateValue>,
    initialState: undefined as StateValue | undefined
  };

  private idMap: Record<string, StateNode> = {};

  constructor(
    public config:
      | SimpleOrCompoundStateNodeConfig
      | StandardMachineConfig
      | ParallelMachineConfig
  ) {
    this.key = config.key || '(machine)';
    this.parent = config.parent;
    this.machine = this.parent ? this.parent.machine : this;
    this.path = this.parent ? this.parent.path.concat(this.key) : [];
    this.delimiter =
      config.delimiter ||
      (this.parent ? this.parent.delimiter : STATE_DELIMITER);
    this.id =
      config.id ||
      (this.machine
        ? [this.machine.key, ...this.path].join(this.delimiter)
        : this.key);
    this.initial = config.initial;
    this.parallel = !!config.parallel;
    this.states = (config.states
      ? mapValues<
          SimpleOrCompoundStateNodeConfig,
          StateNode
        >(config.states, (stateConfig, key) => {
          const stateNode = new StateNode({
            ...stateConfig,
            key,
            parent: this
          });
          Object.assign(this.idMap, {
            [stateNode.id]: stateNode,
            ...stateNode.idMap
          });
          return stateNode;
        })
      : {}) as Record<string, StateNode>;

    this.on = config.on ? this.formatTransitions(config.on) : {};
    this.strict = !!config.strict;
    this.onEntry = config.onEntry
      ? ([] as Action[]).concat(config.onEntry)
      : [];

    if (this.on[NULL_EVENT]) {
      this.onEntry.push({ type: actionTypes.null });
    }

    this.onExit = config.onExit ? ([] as Action[]).concat(config.onExit) : [];
    this.data = config.data;
    this.activities = config.activities;
  }
  public getStateNodes(state: StateValue | State): StateNode[] {
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
    const subStateNodes: StateNode[] = subStateKeys.map(subStateKey =>
      this.getStateNode(subStateKey)
    );

    return subStateNodes.concat(
      subStateKeys.reduce(
        (allSubStateNodes, subStateKey) => {
          const subStateNode = this.getStateNode(subStateKey).getStateNodes(
            stateValue[subStateKey]
          );

          return allSubStateNodes.concat(subStateNode);
        },
        [] as StateNode[]
      )
    );
  }
  public handles(event: Event): boolean {
    const eventType = getEventType(event);

    return this.events.indexOf(eventType) !== -1;
  }
  public _transitionLeafNode(
    stateValue: string,
    state: State,
    event: Event,
    extendedState?: any
  ): _StateTransition {
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
          exit: new Set<StateNode>([
            stateNode,
            ...(entryExitStates
              ? Array.from(entryExitStates.exit)
              : [] as StateNode[])
          ])
        },
        actions,
        paths
      };
    }

    return next;
  }
  public _transitionHierarchicalNode(
    stateValue: StateValueMap,
    state: State,
    event: Event,
    extendedState?: any
  ): _StateTransition {
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
          exit: new Set<StateNode>([
            ...(next.entryExitStates
              ? Array.from(next.entryExitStates.exit)
              : []),
            stateNode,
            ...(entryExitStates
              ? Array.from(entryExitStates.exit)
              : [] as StateNode[])
          ])
        },
        actions,
        paths
      };
    }

    return next;
  }
  public _transitionOrthogonalNode(
    stateValue: StateValueMap,
    state: State,
    event: Event,
    extendedState?: any
  ): _StateTransition {
    const noTransitionKeys: string[] = [];
    const transitions = mapValues(stateValue, (subStateValue, subStateKey) => {
      const next = this.getStateNode(subStateKey)._transition(
        subStateValue,
        state,
        event,
        extendedState
      );

      if (!next.value) {
        noTransitionKeys.push(subStateKey);
      }

      return next;
    });

    const willTransition = Object.keys(transitions).some(
      key => transitions[key].value !== undefined
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

    const nextStateValue = this.parent
      ? {
          [this.key]: mapValues(transitions, (transition, key) => {
            return transition.value === undefined
              ? path(this.path)(state.value)[key]
              : this.parent
                ? path(this.path)(transition.value!)[key]
                : transition.value![key];
          })
        }
      : mapValues(transitions, (transitionStateValue, key) => {
          return transitionStateValue.value === undefined
            ? stateValue[key]
            : this.parent
              ? transitionStateValue.value![this.key][key]
              : transitionStateValue.value![key];
        });

    return {
      value: nextStateValue,
      entryExitStates: Object.keys(transitions).reduce(
        (allEntryExitStates, key) => {
          const { value: subStateValue, entryExitStates } = transitions[key];

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
        { entry: new Set(), exit: new Set() } as EntryExitStates
      ),
      actions: flatMap(
        Object.keys(transitions).map(key => {
          return transitions[key].actions;
        })
      ),
      paths: toStatePaths(nextStateValue)
    };
  }
  public _transition(
    stateValue: StateValue,
    state: State,
    event: Event,
    extendedState?: any
  ): _StateTransition {
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
  public _next(
    state: State,
    event: Event,
    extendedState?: any
  ): _StateTransition {
    const eventType = getEventType(event);

    const candidates = this.on[eventType];

    if (!candidates || !candidates.length) {
      return {
        value: undefined,
        entryExitStates: undefined,
        actions: [],
        paths: []
      };
    }

    let nextStateStrings: string[] = [];
    let actions: Action[] = [];
    let selectedTransition: TargetTransitionConfig;

    for (const candidate of candidates) {
      const {
        cond,
        in: stateIn
        // actions: transitionActions
      } = candidate as TransitionConfig;
      const extendedStateObject = extendedState || {};
      const eventObject = toEventObject(event);

      const isInState = stateIn
        ? matchesState(
            toStateValue(stateIn, this.delimiter),
            path(this.path.slice(0, -2))(state.value)
          )
        : true;

      if (
        (!cond || cond(extendedStateObject, eventObject)) &&
        (!stateIn || isInState)
      ) {
        nextStateStrings = Array.isArray(candidate.target)
          ? candidate.target
          : [candidate.target];
        actions = candidate.actions || []; // TODO: fixme;
        selectedTransition = candidate;
        break;
      }
    }

    if (nextStateStrings.length === 0) {
      return {
        value: undefined,
        entryExitStates: undefined,
        actions: [],
        paths: []
      };
    }

    const nextStateNodes = flatMap(
      nextStateStrings.map(str =>
        this.getRelativeStateNodes(str, state.history)
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
      { entry: new Set(), exit: new Set() } as EntryExitStates
    );

    return {
      value: this.machine.resolve(
        pathsToStateValue(
          flatMap(
            nextStateStrings.map(str =>
              this.getRelativeStateNodes(str, state.history).map(s => s.path)
            )
          )
        )
      ),
      entryExitStates,
      actions,
      paths: nextStatePaths
    };
  }
  public _getEntryExitStates(
    nextStateNode: StateNode,
    internal: boolean
  ): EntryExitStates {
    const entryExitStates = {
      entry: [] as StateNode[],
      exit: [] as StateNode[]
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

    let marker: StateNode = parent;
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
  private _getActions(_t: _StateTransition): Action[] {
    const _ees = {
      entry: _t.entryExitStates
        ? flatMap(
            Array.from(_t.entryExitStates.entry).map(n => [
              ...n.onEntry,
              ...(n.activities
                ? n.activities.map(activity => start(activity))
                : [])
            ])
          )
        : [],
      exit: _t.entryExitStates
        ? flatMap(
            Array.from(_t.entryExitStates.exit).map(n => [
              ...n.onExit,
              ...(n.activities
                ? n.activities.map(activity => stop(activity))
                : [])
            ])
          )
        : []
    };

    const actions = (_ees.exit || [])
      .concat(_t.actions || [])
      .concat(_ees.entry || []);

    return actions;
  }
  private _getActivities(state: State, _t: _StateTransition): ActivityMap {
    if (!_t.entryExitStates) {
      return {};
    }

    const activityMap = { ...state.activities };

    Array.from(_t.entryExitStates.entry).forEach(stateNode => {
      if (!stateNode.activities) {
        return; // TODO: fixme
      }

      stateNode.activities.forEach(activity => {
        activityMap[getActionType(activity)] = true;
      });
    });

    Array.from(_t.entryExitStates.exit).forEach(stateNode => {
      if (!stateNode.activities) {
        return; // TODO: fixme
      }

      stateNode.activities.forEach(activity => {
        activityMap[getActionType(activity)] = false;
      });
    });

    return activityMap;
  }
  public transition(
    state: StateValue | State,
    event: Event,
    extendedState?: any
  ): State {
    const resolvedStateValue =
      typeof state === 'string'
        ? this.resolve(pathToStateValue(this.getResolvedPath(state)))
        : state instanceof State ? state : this.resolve(state);

    const eventType = getEventType(event);

    if (this.strict) {
      if (this.events.indexOf(eventType) === -1) {
        throw new Error(
          `Machine '${this.id}' does not accept event '${eventType}'`
        );
      }
    }

    const currentState = State.from(resolvedStateValue);

    const stateTransition = this._transition(
      currentState.value,
      currentState,
      event,
      extendedState
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

    const stateNodes = stateTransition.value
      ? this.getStateNodes(stateTransition.value!)
      : [];
    const data = {};

    stateNodes.forEach(stateNode => {
      data[stateNode.id] = stateNode.data;
    });

    const nextState = stateTransition.value
      ? new State(
          stateTransition.value,
          currentState,
          actions,
          activities,
          data
        )
      : undefined;

    if (!nextState) {
      return State.from(currentState);
    }

    const raisedEvents = actions.filter(
      action =>
        typeof action === 'object' &&
        (action.type === actionTypes.raise || action.type === actionTypes.null)
    ) as ActionObject[];

    const nonEventActions = actions.filter(
      action =>
        typeof action !== 'object' ||
        (action.type !== actionTypes.raise && action.type !== actionTypes.null)
    );

    nextState.value = stateTransition.value!;
    nextState.actions = nonEventActions;
    nextState.activities = activities;

    if (raisedEvents.length) {
      const raised =
        raisedEvents[0].type === actionTypes.raise
          ? raisedEvents[0].event!
          : undefined;
      const nullEvent = raisedEvents[0].type === actionTypes.null;

      if (raised || nullEvent) {
        const maybeNextState = this.transition(
          nextState,
          nullEvent ? NULL_EVENT : raised,
          extendedState
        );
        maybeNextState.actions.unshift(...nextState.actions);
        return maybeNextState;
      }
    }

    return nextState;
  }
  private ensureValidPaths(paths: string[][]): void {
    const visitedParents = new Map<StateNode, StateNode[]>();

    const stateNodes = flatMap(
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
            `State node '${stateNode.id}' shares parent '${marker.parent
              .id}' with state node '${visitedParents.get(marker.parent)!.map(
              a => a.id
            )}'`
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
  public getStateNode(stateKey: string): StateNode {
    if (isStateId(stateKey)) {
      return this.machine.getStateNodeById(stateKey);
    }

    if (!this.states) {
      throw new Error(
        `Unable to retrieve child state '${stateKey}' from '${this
          .id}'; no child states exist.`
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
  public getStateNodeById(stateId: string): StateNode {
    const resolvedStateId = isStateId(stateId)
      ? stateId.slice(STATE_IDENTIFIER.length)
      : stateId;
    const stateNode = this.machine.idMap[resolvedStateId];

    if (!stateNode) {
      throw new Error(
        `Substate '#${resolvedStateId}' does not exist on '${this.id}'`
      );
    }

    return stateNode;
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
          return this.getStateNode(subStateKey).resolve(
            stateValue[subStateKey] || subStateValue
          );
        }
      );
    }

    return mapValues(stateValue, (subStateValue, subStateKey) => {
      return this.getStateNode(subStateKey).resolve(subStateValue);
    });
  }

  private get resolvedStateValue(): StateValue {
    const { key } = this;

    if (this.parallel) {
      return {
        [key]: mapValues(
          this.states,
          stateNode => stateNode.resolvedStateValue[stateNode.key]
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
    const initialStateValue =
      this.__cache.initialState ||
      ((this.parallel
        ? mapValues(
            this.states as Record<string, StateNode>,
            state => state.initialStateValue
          )
        : typeof this.resolvedStateValue === 'string'
          ? undefined
          : this.resolvedStateValue[this.key]) as StateValue);

    this.__cache.initialState = initialStateValue;

    return this.__cache.initialState;
  }
  public get initialState(): State {
    const { initialStateValue } = this;

    if (!initialStateValue) {
      throw new Error(
        `Cannot retrieve initial state from simple state '${this.id}.'`
      );
    }

    const activityMap: ActivityMap = {};
    const actions: Action[] = [];

    this.getStateNodes(initialStateValue).forEach(stateNode => {
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

    return new State(initialStateValue, undefined, actions, activityMap);
  }
  public getStates(stateValue: StateValue): StateNode[] {
    if (typeof stateValue === 'string') {
      return [this.states[stateValue]];
    }

    const stateNodes: StateNode[] = [];

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
    history?: State,
    resolve: boolean = true
  ): StateNode[] {
    const historyValue = history ? history.value : undefined;
    if (typeof relativeStateId === 'string' && isStateId(relativeStateId)) {
      const unresolvedStateNode = this.getStateNodeById(relativeStateId);

      return resolve
        ? unresolvedStateNode.initialStateNodes
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
    return flatMap(
      unresolvedStateNodes.map(stateNode => stateNode.initialStateNodes)
    );
  }
  public get initialStateNodes(): StateNode[] {
    // todo - isLeafNode or something
    if (!this.parallel && !this.initial) {
      return [this];
    }

    const { initialState } = this;
    const initialStateNodePaths = toStatePaths(initialState.value);
    return flatMap(
      initialStateNodePaths.map(initialPath =>
        this.getFromRelativePath(initialPath)
      )
    );
  }
  public getFromRelativePath(
    relativePath: string[],
    historyValue?: StateValue
  ): StateNode[] {
    if (!relativePath.length) {
      return [this];
    }

    const [x, ...xs] = relativePath;

    if (!this.states) {
      throw new Error(
        `Cannot retrieve subPath '${x}' from node with no states`
      );
    }

    if (x === '' || (!this.parent && this.key === x)) {
      return this.getFromRelativePath(xs, historyValue);
    }

    if (x === HISTORY_KEY) {
      if (!historyValue) {
        return [this];
      }
      const subHistoryValue = path(this.path)(historyValue);

      if (typeof subHistoryValue === 'string') {
        return this.states[subHistoryValue].getFromRelativePath(
          xs,
          historyValue
        );
      }

      return flatMap(
        Object.keys(subHistoryValue).map(key => {
          return this.states[key].getFromRelativePath(xs, historyValue);
        })
      );
    }

    if (!this.states[x]) {
      throw new Error(`Child state '${x}' does not exist on '${this.id}'`);
    }

    return this.states[x].getFromRelativePath(xs, historyValue);
  }
  get events(): EventType[] {
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
  private formatTransitions(
    onConfig: Record<string, Transition | undefined>
  ): Record<string, ConditionalTransitionConfig> {
    return mapValues(onConfig, value => {
      if (value === undefined) {
        return [];
      }

      if (Array.isArray(value)) {
        // todo - consolidate internal normalizations
        return value;
      }

      if (typeof value === 'string') {
        const internal = typeof value === 'string' && value[0] === '.';
        return [
          {
            target: internal ? this.key + value : value,
            internal
          }
        ];
      }

      return Object.keys(value).map(target => {
        const internal = typeof target === 'string' && target[0] === '.';

        return {
          target: internal ? this.key + '.' + target : target,
          internal,
          ...value[target]
        };
      });
    });
  }
}

export function Machine(
  config: MachineConfig | ParallelMachineConfig
): StandardMachine | ParallelMachine {
  return new StateNode(config) as StandardMachine | ParallelMachine;
}

export { StateNode };
