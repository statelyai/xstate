import { getEventType, toStatePath, toTrie, mapValues } from './utils';
import {
  Event,
  StateValue,
  Transition,
  Action,
  Machine,
  StandardMachine,
  ParallelMachine,
  StateOrMachineConfig,
  MachineConfig,
  ParallelMachineConfig,
  EventType,
  EventObject
} from './types';
import matchesState from './matchesState';
import mapState from './mapState';
import State from './State';

const STATE_DELIMITER = '.';
const HISTORY_KEY = '$history';

class StateNode<
  TStateKey extends string = string,
  TEventType extends string = string
> {
  public key: string;
  public id: string;
  public relativeId: string;
  public initial?: string;
  public parallel?: boolean;
  public states: Record<TStateKey, StateNode>;
  public on?: Record<TEventType, Transition<TStateKey> | undefined>;
  public onEntry?: Action[];
  public onExit?: Action[];
  public strict: boolean;
  public parent?: StateNode;
  public machine: StateNode;

  private __cache = {
    events: undefined as EventType[] | undefined,
    relativeValue: new Map() as Map<StateNode, StateValue>,
    initialState: undefined as StateValue | undefined
  };

  constructor(public config: StateOrMachineConfig<TStateKey, TEventType>) {
    this.key = config.key || '(machine)';
    this.parent = config.parent;
    this.machine = this.parent ? this.parent.machine : this;
    this.id = this.parent
      ? this.parent.id + STATE_DELIMITER + this.key
      : this.key;
    this.relativeId =
      this.parent && this.parent.parent
        ? this.parent.relativeId + STATE_DELIMITER + this.key
        : this.key;
    this.initial = config.initial;
    this.parallel = !!config.parallel;
    this.states = (config.states
      ? mapValues<StateOrMachineConfig, StateNode>(
          config.states,
          (stateConfig, key) =>
            new StateNode({
              ...stateConfig,
              key,
              parent: this
            })
        )
      : {}) as Record<TStateKey, StateNode<string, string>>;

    this.on = config.on;
    this.onEntry = config.onEntry
      ? ([] as Action[]).concat(config.onEntry)
      : undefined;
    this.onExit = config.onExit
      ? ([] as Action[]).concat(config.onExit)
      : undefined;
    this.strict = !!config.strict;
  }
  public getStateNodes(state: StateValue | State): StateNode[] {
    const stateValue = state instanceof State ? state.value : toTrie(state);

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
        .map(subStateKey =>
          this.states[subStateKey].getStateNodes(stateValue[subStateKey])
        )
        .reduce((a, b) => a.concat(b))
    );
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

    const stateValue = state instanceof State ? state.value : toTrie(state);
    const nextStateValueActionsTuple = this.transitionStateValue(
      state,
      event,
      extendedState
    );

    if (!nextStateValueActionsTuple) {
      return State.inert(state);
    }

    const [nextStateValue, actions] = nextStateValueActionsTuple;

    return new State(
      // next state value
      nextStateValue,
      // history
      State.from(state),
      // effects
      this.getActions(stateValue, nextStateValue, actions)
    );
  }
  public maybeTransition(
    state: StateValue | State,
    event: Event,
    extendedState?: any
  ): State {
    const nextState = this.transition(state, event, extendedState);

    if (!nextState) {
      const stateValue = state instanceof State ? state.value : toTrie(state);
      return new State(stateValue, State.from(state));
    }

    return nextState;
  }
  private transitionStateValue(
    state: StateValue | State,
    event: Event,
    extendedState?: any
  ): [StateValue, Action[]] | undefined {
    const history = state instanceof State ? state.history : undefined;
    let stateValue = state instanceof State ? state.value : toTrie(state);

    if (typeof stateValue === 'string') {
      if (!this.states[stateValue]) {
        throw new Error(
          `State '${stateValue}' does not exist on machine '${this.id}'`
        );
      }

      const subState = this.states[stateValue] as StateNode;
      const initialState = subState.initialState;

      if (initialState) {
        stateValue = { [stateValue]: initialState };
      } else {
        return subState.next(
          event,
          history ? history.value : undefined,
          extendedState
        );
      }
    }

    let nextStateValue = mapValues(stateValue, (subStateValue, subStateKey) => {
      if (!this.states[subStateKey]) {
        return undefined;
      }

      const subHistory = history ? history.value[subStateKey] : undefined;
      const subState = new State(
        subStateValue,
        subHistory ? State.from(subHistory) : undefined
      );
      const subStateNode = this.states[subStateKey] as StateNode;
      const nextSubStateValueActionsTuple = subStateNode.transitionStateValue(
        subState,
        event,
        extendedState
      );

      return nextSubStateValueActionsTuple || undefined;
    });

    if (
      Array.prototype.every.call(Object.keys(nextStateValue), key => {
        return nextStateValue[key] === undefined;
      })
    ) {
      if (this.parallel) {
        return undefined;
      }

      const subStateKey = Object.keys(nextStateValue)[0];
      return this.states[subStateKey].next(
        event,
        history ? history.value : undefined
      );
    }

    if (this.parallel) {
      nextStateValue = {
        ...(mapValues(this.initialState as {}, subStateValue => [
          subStateValue,
          []
        ]) as Record<string, [StateValue, string[]]>),
        ...nextStateValue
      };
    }

    const actions: Action[] = [];
    const finalStateValue = mapValues(
      nextStateValue,
      (valueActionsTuple, key) => {
        if (!valueActionsTuple) {
          return stateValue[key];
        }

        const [value, subActions] = valueActionsTuple;

        actions.push(...subActions);
        return value;
      }
    );

    return [finalStateValue, actions];
  }

  private next(
    event: Event,
    history?: StateValue,
    extendedState?: any
  ): [StateValue, Action[]] | undefined {
    const eventType = getEventType(event);
    let actions: Action[] = [];

    if (!this.on || !this.on[eventType]) {
      return undefined;
    }

    const transition = this.on[eventType] as Transition;
    let nextStateString: string | undefined;
    if (typeof transition === 'string') {
      nextStateString = transition;
      actions = [];
    } else {
      for (const candidate of Object.keys(transition)) {
        const { cond, actions: transitionActions } = transition[candidate];
        const eventObject: EventObject =
          typeof event === 'string' || typeof event === 'number'
            ? { type: event }
            : event;
        if (!cond || cond(extendedState, eventObject)) {
          nextStateString = candidate;
          if (transitionActions) {
            actions = transitionActions;
          }
          break;
        }
      }
    }

    if (!nextStateString) {
      return undefined;
    }

    const nextStatePath = toStatePath(nextStateString);
    let currentState = this.parent;
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
      }

      if (typeof subPath === 'object') {
        subPath = Object.keys(subPath)[0];
      }

      currentState = currentState.states[subPath];

      if (currentState === undefined) {
        throw new Error(
          `Event '${event}' on state '${currentPath}' leads to undefined state '${nextStatePath}'.`
        );
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
    }

    return [currentState.getRelativeValue(this.parent), actions];
  }
  public get initialState(): StateValue | undefined {
    this.__cache.initialState =
      this.__cache.initialState ||
      ((this.parallel
        ? mapValues(
            this.states as Record<string, StateNode>,
            state => state.initialState
          )
        : this.initial) as StateValue);

    return this.__cache.initialState;
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
            events.add(event);
          }
        }
      });
    }

    return (this.__cache.events = Array.from(events));
  }
  public getRelativeValue(toNode?: StateNode): StateValue {
    const memoizedRelativeValue = toNode
      ? this.__cache.relativeValue.get(toNode)
      : undefined;

    if (memoizedRelativeValue) {
      return memoizedRelativeValue;
    }

    const initialState = this.initialState;
    let relativeValue = initialState
      ? {
          [this.key]: initialState
        }
      : this.key;
    let currentNode: StateNode = this.parent as StateNode;

    while (currentNode && currentNode !== toNode) {
      const currentInitialState = currentNode.initialState;
      relativeValue = {
        [currentNode.key]:
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
  private getActions(
    prevStateValue: StateValue,
    nextStateValue: StateValue,
    actions: Action[]
  ): Action[] {
    const entry: Action[] = [];
    const exitActionMap: Record<string, Action[]> = {};

    // Naively set all exit effects
    const prevStateNodes = this.getStateNodes(prevStateValue);

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < prevStateNodes.length; i++) {
      const prevStateNode = prevStateNodes[prevStateNodes.length - 1 - i];

      if (prevStateNode.onExit) {
        exitActionMap[prevStateNode.id] = prevStateNode.onExit;
      }
    }

    // Set all entry effects, only if the state is being entered
    const nextStateNodes = this.getStateNodes(nextStateValue);

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < nextStateNodes.length; i++) {
      const nextStateNode = nextStateNodes[i];

      if (exitActionMap[nextStateNode.id]) {
        // Remove false exit effects
        delete exitActionMap[nextStateNode.id];
      } else if (nextStateNode.onEntry) {
        entry.push(...nextStateNode.onEntry);
      }
    }

    const exit = Object.keys(exitActionMap)
      .map(id => exitActionMap[id])
      .reduce((a, b) => a.concat(b), []);

    return [...exit, ...actions, ...entry];
  }
}

export interface MachineFactory {
  (config: MachineConfig | ParallelMachineConfig):
    | StandardMachine
    | ParallelMachine;
  standard: (config: MachineConfig) => StandardMachine;
  parallel: (config: ParallelMachineConfig) => ParallelMachine;
}

const Machine = (() => {
  const machineFactory = (
    config: MachineConfig | ParallelMachineConfig
  ): StandardMachine | ParallelMachine => {
    return new StateNode(config) as StandardMachine | ParallelMachine;
  };

  (machineFactory as any).standard = (
    config: MachineConfig
  ): StandardMachine => {
    return new StateNode(config) as StandardMachine;
  };

  (machineFactory as any).parallel = (
    config: ParallelMachineConfig
  ): ParallelMachine => {
    return new StateNode(config) as ParallelMachine;
  };

  return machineFactory as MachineFactory;
})();

export { StateNode, Machine, State, matchesState, mapState };
