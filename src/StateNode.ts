import {
  getEventType,
  toStatePath,
  toStateValue,
  mapValues,
  path
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
  ActionMap,
  StandardMachineConfig,
  TransitionConfig,
  ActivityMap,
  StateNodeConfig,
  Activity,
  StateTransition,
  EventObject
} from './types';
import { matchesState } from './matchesState';
import { State } from './State';
import { start, stop, toEventObject, actionTypes } from './actions';

const STATE_DELIMITER = '.';
const HISTORY_KEY = '$history';
const NULL_EVENT = '';
class StateNode implements StateNodeConfig {
  public key: string;
  public id: string;
  public path: string[];
  public initial?: string;
  public parallel?: boolean;
  public states: Record<string, StateNode>;
  public on?: Record<string, Transition | undefined>;
  public onEntry?: Action[];
  public onExit?: Action[];
  public activities?: Activity[];
  public strict: boolean;
  public parent?: StateNode;
  public machine: StateNode;
  public data: object | undefined;

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
    this.id =
      config.id ||
      (this.parent
        ? this.parent.path.concat(this.key).join(STATE_DELIMITER)
        : this.key);
    this.path = this.parent ? this.parent.path.concat(this.key) : [this.key];
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

    this.on = config.on;
    this.strict = !!config.strict;
    this.onEntry = config.onEntry
      ? ([] as Action[]).concat(config.onEntry)
      : undefined;
    this.onExit = config.onExit
      ? ([] as Action[]).concat(config.onExit)
      : undefined;
    this.data = config.data;
    this.activities = config.activities;
  }
  public getStateNodes(state: StateValue | State): StateNode[] {
    const stateValue =
      state instanceof State ? state.value : toStateValue(state);

    if (typeof stateValue === 'string') {
      const initialStateValue = (this.states[stateValue] as StateNode).initial;

      return initialStateValue
        ? this.getStateNodes({ [stateValue]: initialStateValue })
        : [this.states[stateValue]];
    }

    const subStateKeys = Object.keys(stateValue);
    const subStateNodes: StateNode[] = subStateKeys.map(
      subStateKey => this.states[subStateKey]
    );

    return subStateNodes.concat(
      subStateKeys
        .map(subStateKey => {
          return this.states[subStateKey].getStateNodes(
            stateValue[subStateKey]
          );
        })
        .reduce((a, b) => a.concat(b))
    );
  }
  public handles(event: Event): boolean {
    const eventType = getEventType(event);

    return this.events.indexOf(eventType) !== -1;
  }
  public transition(
    state: StateValue | State,
    event: Event,
    extendedState?: any
  ): State {
    if (this.strict) {
      const eventType = getEventType(event);
      if (this.events.indexOf(eventType) === -1) {
        throw new Error(
          `Machine '${this.id}' does not accept event '${eventType}'`
        );
      }
    }

    const currentState = State.from(state);

    const stateTransition = this.transitionStateValue(
      currentState,
      event,
      currentState,
      extendedState
    );
    const nextState = this.stateTransitionToState(
      stateTransition,
      currentState
    );

    if (!nextState) {
      return State.inert(currentState);
    }

    // Try transitioning from "transient" states from the NULL_EVENT
    // until a state with non-transient transitions is found
    let maybeNextState: State | undefined = nextState;

    const raisedEvents = nextState.actions.filter(
      a => typeof a === 'object' && a.type === actionTypes.raise
    );

    if (raisedEvents.length) {
      const raisedEvent = (raisedEvents[0] as EventObject).event!;

      maybeNextState = this.transition(nextState, raisedEvent, extendedState);
      maybeNextState.actions.unshift(...nextState.actions);
      return maybeNextState;
    }

    if (stateTransition.events.length) {
      const raised =
        stateTransition.events[0].type === actionTypes.raise
          ? stateTransition.events[0].event!
          : undefined;
      const nullEvent = stateTransition.events[0].type === actionTypes.null;

      if (raised || nullEvent) {
        maybeNextState = this.transition(
          nextState,
          nullEvent ? '' : raised,
          extendedState
        );
        maybeNextState.actions.unshift(...nextState.actions);
        return maybeNextState;
      }
    }

    return nextState;
  }
  private stateTransitionToState(
    stateTransition: StateTransition,
    prevState: State
  ): State | undefined {
    const {
      stateValue: nextStateValue,
      actions: nextActions,
      activities: nextActivities,
      events
    } = stateTransition;

    if (!nextStateValue) {
      return undefined;
    }

    const prevActivities =
      prevState instanceof State ? prevState.activities : undefined;

    const activities = { ...prevActivities, ...nextActivities };

    return new State(
      // next state value
      nextStateValue,
      // history
      State.from(prevState),
      // effects
      nextActions
        ? nextActions.onExit
            .concat(nextActions.actions)
            .concat(nextActions.onEntry)
        : [],
      // activities
      activities,
      // data
      this.getStateNodes(nextStateValue).reduce(
        (data, stateNode) => {
          if (stateNode.data !== undefined) {
            data[stateNode.id] = stateNode.data;
          }

          return data;
        },
        {} as Record<string, any>
      ),
      events
    );
  }
  private transitionStateValue(
    state: State,
    event: Event,
    fullState: State,
    extendedState?: any
  ): StateTransition {
    const { history } = state;
    let stateValue = state.value;

    if (typeof stateValue === 'string') {
      if (!this.states[stateValue]) {
        throw new Error(
          `State '${stateValue}' does not exist on machine '${this.id}'`
        );
      }

      const subStateNode = this.states[stateValue];
      stateValue = subStateNode.resolvedStateValue;

      if (typeof stateValue === 'string') {
        // Transition from the substate
        return subStateNode.next(
          event,
          fullState,
          history ? history.value : undefined,
          extendedState
        );
      }
    }

    // Potential transition tuples from parent state nodes
    const potentialStateTransitions: StateTransition[] = [];

    let nextStateValue = mapValues(stateValue, (subStateValue, subStateKey) => {
      const subHistory = history ? history.value[subStateKey] : undefined;
      const subState = new State(
        subStateValue,
        subHistory ? State.from(subHistory) : undefined
      );
      const subStateNode = this.states[subStateKey];
      const subStateTransition = subStateNode.transitionStateValue(
        subState,
        event,
        fullState,
        extendedState
      );

      if (!subStateTransition.stateValue) {
        potentialStateTransitions.push(
          subStateNode.next(
            event,
            fullState,
            history ? history.value : undefined,
            extendedState
          )
        );
      }

      return subStateTransition;
    });

    if (
      Array.prototype.every.call(Object.keys(nextStateValue), key => {
        return nextStateValue[key].stateValue === undefined;
      })
    ) {
      if (this.parallel) {
        if (potentialStateTransitions.length) {
          return potentialStateTransitions[0];
        }

        return {
          stateValue: undefined,
          actions: { onEntry: [], onExit: [], actions: [] },
          activities: undefined,
          events: []
        };
      }

      const subStateKey = Object.keys(nextStateValue)[0];

      // try with parent
      const {
        stateValue: parentNextValue,
        actions: parentNextActions,
        activities: parentActivities
      } = this.states[subStateKey].next(
        event,
        fullState,
        history ? history.value : undefined,
        extendedState
      );
      const nextActions = nextStateValue[subStateKey].actions;
      const activities = nextStateValue[subStateKey].activities;

      const allActivities = {
        ...activities,
        ...parentActivities
      };

      const allActions = parentNextActions
        ? nextActions
          ? {
              onEntry: [...nextActions.onEntry, ...parentNextActions.onEntry],
              actions: [...nextActions.actions, ...parentNextActions.actions],
              onExit: [...nextActions.onExit, ...parentNextActions.onExit]
            }
          : parentNextActions
        : nextActions;

      return {
        stateValue: parentNextValue,
        actions: allActions,
        activities: allActivities,
        events: []
      };
    }

    if (this.parallel) {
      nextStateValue = {
        ...mapValues(
          this.initialState.value as Record<string, StateValue>,
          subStateValue => ({
            stateValue: subStateValue,
            actions: { onEntry: [], onExit: [], actions: [] },
            activities: undefined,
            events: []
          })
        ),
        ...nextStateValue
      };
    }

    const finalActions: ActionMap = {
      onEntry: [],
      actions: [],
      onExit: []
    };
    const finalActivities: ActivityMap = {};
    const finalStateValue = mapValues(
      nextStateValue,
      (subStateTransition, key) => {
        const {
          stateValue: nextSubStateValue,
          actions: nextSubActions,
          activities: nextSubActivities
        } = subStateTransition;
        if (nextSubActions) {
          if (nextSubActions.onEntry) {
            finalActions.onEntry.push(...nextSubActions.onEntry);
          }
          if (nextSubActions.actions) {
            finalActions.actions.push(...nextSubActions.actions);
          }
          if (nextSubActions.onExit) {
            finalActions.onExit.push(...nextSubActions.onExit);
          }
        }
        if (nextSubActivities) {
          Object.assign(finalActivities, nextSubActivities);
        }

        if (!nextSubStateValue) {
          return stateValue[key];
        }

        return nextSubStateValue;
      }
    );

    return {
      stateValue: finalStateValue,
      actions: finalActions,
      activities: finalActivities,
      events: []
    };
  }

  private next(
    event: Event,
    fullState: State,
    history?: StateValue,
    extendedState?: any
  ): StateTransition {
    const eventType = getEventType(event);
    const actionMap: ActionMap = { onEntry: [], onExit: [], actions: [] };
    const activityMap: ActivityMap = {};

    if (this.onExit) {
      actionMap.onExit = this.onExit;
    }
    if (this.activities) {
      this.activities.forEach(activity => {
        activityMap[getEventType(activity)] = false;
        actionMap.onExit = actionMap.onExit.concat(stop(activity));
      });
    }

    if (!this.on || !this.on[eventType]) {
      return {
        stateValue: undefined,
        actions: actionMap,
        activities: activityMap,
        events: []
      };
    }

    const transition = this.on[eventType] as Transition;
    let nextStateString: string | undefined;

    if (typeof transition === 'string') {
      nextStateString = transition;
    } else {
      const candidates = Array.isArray(transition)
        ? transition
        : Object.keys(transition).map(key => ({
            ...transition[key],
            target: key
          }));

      for (const candidate of candidates) {
        const {
          cond,
          in: stateIn,
          actions: transitionActions
        } = candidate as TransitionConfig;
        const extendedStateObject = extendedState || {};
        const eventObject = toEventObject(event);

        const isInState = stateIn
          ? matchesState(
              toStateValue(stateIn),
              path(this.path.slice(1, -2))(fullState.value)
            )
          : true;

        if (
          (!cond || cond(extendedStateObject, eventObject)) &&
          (!stateIn || isInState)
        ) {
          nextStateString = candidate.target;
          if (transitionActions) {
            actionMap.actions = actionMap.actions.concat(transitionActions);
          }
          break;
        }
      }
    }

    if (!nextStateString) {
      return {
        stateValue: undefined,
        actions: actionMap,
        activities: activityMap,
        events: []
      };
    }

    const nextStatePath = this.getResolvedPath(nextStateString);
    const isId = nextStateString[0] === '#';
    let currentState = isId ? this.machine : this.parent;
    let currentHistory = history;
    let currentPath = this.key;

    nextStatePath.forEach(subPath => {
      if (!currentState || !currentState.states) {
        throw new Error(`Unable to read '${subPath}'`);
      }

      if (subPath === HISTORY_KEY) {
        if (currentHistory) {
          subPath =
            typeof currentHistory === 'object'
              ? Object.keys(currentHistory)[0]
              : currentHistory;
        } else if (currentState.initial) {
          subPath = currentState.initial;
        } else {
          throw new Error(
            `Cannot read '${HISTORY_KEY}' from state '${currentState.id}': missing 'initial'`
          );
        }
      } else if (subPath === NULL_EVENT) {
        actionMap.onExit = [];
        currentState = currentState.states[this.key];
        return;
      }

      currentState = currentState.states[subPath];

      if (currentState === undefined) {
        throw new Error(
          `Event '${event}' on state '${currentPath}' leads to undefined state '${nextStatePath.join(
            STATE_DELIMITER
          )}'.`
        );
      }

      if (currentState.onEntry) {
        actionMap.onEntry = actionMap.onEntry.concat(currentState.onEntry);
      }
      if (currentState.activities) {
        currentState.activities.forEach(activity => {
          activityMap[getEventType(activity)] = true;
          actionMap.onEntry = actionMap.onEntry.concat(start(activity));
        });
      }

      currentPath = subPath;

      if (currentHistory) {
        currentHistory = currentHistory[subPath];
      }
    });

    if (!currentState) {
      throw new Error('no state');
    }

    while (currentState.initial) {
      if (!currentState || !currentState.states) {
        throw new Error(`Invalid initial state`);
      }
      currentState = currentState.states[currentState.initial];

      if (currentState.onEntry) {
        actionMap.onEntry = actionMap.onEntry.concat(currentState.onEntry);
      }
      if (currentState.activities) {
        currentState.activities.forEach(activity => {
          activityMap[getEventType(activity)] = true;
          actionMap.onEntry = actionMap.onEntry.concat(start(activity));
        });
      }
    }

    const raisedEvents = (currentState.onEntry
      ? currentState.onEntry.filter(
          a => typeof a === 'object' && a.type === actionTypes.raise
        )
      : []
    ).concat(
      currentState.on && currentState.on[''] ? { type: actionTypes.null } : []
    );

    return {
      stateValue: currentState.getRelativeValue(this.parent),
      actions: actionMap,
      activities: activityMap,
      events: raisedEvents as EventObject[]
    };
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
    if (stateIdentifier[0] === '#') {
      const stateNode = this.machine.idMap[stateIdentifier.slice(1)];

      if (!stateNode) {
        throw new Error(`Unable to find state node '${stateIdentifier}'`);
      }

      return stateNode.path.slice(1);
    }

    return toStatePath(stateIdentifier);
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

    const entryActions = this.getStateNodes(initialStateValue).reduce(
      (actions, stateNode) =>
        stateNode.onEntry ? actions.concat(stateNode.onEntry) : actions,
      [] as Action[]
    );

    return new State(initialStateValue, undefined, entryActions);
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
  public getState(relativeStateId: string | string[]): StateNode | undefined {
    const statePath = toStatePath(relativeStateId);

    try {
      return statePath.reduce(
        (subState, subPath) => {
          if (!subState.states) {
            throw new Error(
              `Cannot retrieve subPath '${subPath}' from node with no states`
            );
          }
          return subState.states[subPath];
        },
        this as StateNode
      );
    } catch (e) {
      throw new Error(
        `State '${relativeStateId} does not exist on machine '${this.id}'`
      );
    }
  }
  get events(): EventType[] {
    if (this.__cache.events) {
      return this.__cache.events;
    }
    const { states } = this;
    const events = new Set(this.on ? Object.keys(this.on) : undefined);

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
  private getRelativeValue(toNode?: StateNode): StateValue {
    const memoizedRelativeValue = toNode
      ? this.__cache.relativeValue.get(toNode)
      : undefined;

    if (memoizedRelativeValue) {
      return memoizedRelativeValue;
    }

    const initialStateValue = this.initialStateValue;
    let relativeValue = initialStateValue
      ? {
          [this.key]: initialStateValue
        }
      : this.key;
    let currentNode: StateNode = this.parent as StateNode;

    while (currentNode && currentNode !== toNode) {
      const currentInitialState = currentNode.initialStateValue;
      relativeValue = {
        [currentNode.key]:
          currentNode.parallel &&
          typeof currentInitialState === 'object' &&
          typeof relativeValue === 'object'
            ? { ...currentInitialState, ...relativeValue }
            : relativeValue
      };
      currentNode = currentNode.parent as StateNode;
    }

    this.__cache.relativeValue.set(toNode as StateNode, relativeValue);

    return relativeValue;
  }
}

export function Machine(
  config: MachineConfig | ParallelMachineConfig
): StandardMachine | ParallelMachine {
  return new StateNode(config) as StandardMachine | ParallelMachine;
}

export { StateNode };
