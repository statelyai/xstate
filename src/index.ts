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
  public handles(event: Event): boolean {
    const eventType = getEventType(event);
    return this.on && this.on[eventType];
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

    // const stateValue = toTrie(state);
    const [nextStateValue, nextActions] = this.transitionStateValue(
      state,
      event,
      extendedState
    );

    if (!nextStateValue) {
      return State.inert(state);
    }

    return new State(
      // next state value
      nextStateValue,
      // history
      State.from(state),
      // effects
      nextActions
    );
  }
  private transitionStateValue(
    state: StateValue | State,
    event: Event,
    extendedState?: any
  ): [StateValue | undefined, Action[]] {
    const history = state instanceof State ? state.history : undefined;
    let stateValue = toTrie(state);

    if (typeof stateValue === 'string') {
      if (!this.states[stateValue]) {
        throw new Error(
          `State '${stateValue}' does not exist on machine '${this.id}'`
        );
      }

      const subStateNode = this.states[stateValue] as StateNode;
      if (subStateNode.states && subStateNode.initial) {
        const initialStateValue = subStateNode.initialState.value;

        stateValue = { [stateValue]: initialStateValue };
      } else {
        return subStateNode.next(
          event,
          history ? history.value : undefined,
          extendedState
        );
      }
    }

    let nextStateValue = mapValues(stateValue, (subStateValue, subStateKey) => {
      const subHistory = history ? history.value[subStateKey] : undefined;
      const subState = new State(
        subStateValue,
        subHistory ? State.from(subHistory) : undefined
      );
      const subStateNode = this.states[subStateKey] as StateNode;
      const nextTuple = subStateNode.transitionStateValue(
        subState,
        event,
        extendedState
      );

      return nextTuple;
    });

    if (
      Array.prototype.every.call(Object.keys(nextStateValue), key => {
        return nextStateValue[key][0] === undefined;
      })
    ) {
      if (this.parallel) {
        return [undefined, []];
      }

      const subStateKey = Object.keys(nextStateValue)[0];

      // try with parent
      const [parentNextValue, parentNextActions] = this.states[
        subStateKey
      ].next(event, history ? history.value : undefined);

      return [
        parentNextValue,
        nextStateValue[subStateKey][1].concat(parentNextActions)
      ];
    }

    if (this.parallel) {
      nextStateValue = {
        ...(mapValues(this.initialState.value as {}, subStateValue => [
          subStateValue,
          []
        ]) as Record<string, [StateValue, string[]]>),
        ...nextStateValue
      };
    }

    const actionsArray: Action[][] = [];
    const finalStateValue = mapValues(
      nextStateValue,
      ([nextSubStateValue, nextSubActions], key) => {
        actionsArray.push(nextSubActions);
        if (!nextSubStateValue) {
          return stateValue[key];
        }

        return nextSubStateValue;
      }
    );

    // zip array
    function zip<T>(arrays: T[][]): T[] {
      const maxLength = Math.max(...arrays.map(a => a.length));
      const result: T[] = [];

      for (let i = 0; i < maxLength; i++) {
        for (const array of arrays) {
          if (array[i]) {
            result.push(array[i]);
          }
        }
      }

      return result;
    }

    return [finalStateValue, zip(actionsArray)];
  }

  private next(
    event: Event,
    history?: StateValue,
    extendedState?: any
  ): [StateValue | undefined, Action[]] {
    const eventType = getEventType(event);
    const actions: Action[] = [];

    if (this.onExit) {
      actions.push(...this.onExit);
    }

    if (!this.on || !this.on[eventType]) {
      return [undefined, actions];
    }

    const transition = this.on[eventType] as Transition;
    let nextStateString: string | undefined;

    if (typeof transition === 'string') {
      nextStateString = transition;
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
            actions.push(...transitionActions);
          }
          break;
        }
      }
    }

    if (!nextStateString) {
      return [undefined, actions];
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

      currentState = currentState.states[subPath];

      if (currentState === undefined) {
        throw new Error(
          `Event '${event}' on state '${currentPath}' leads to undefined state '${nextStatePath}'.`
        );
      }

      if (currentState.onEntry) {
        actions.push(...currentState.onEntry);
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
        actions.push(...currentState.onEntry);
      }
    }

    return [currentState.getRelativeValue(this.parent), actions];
  }
  private get initialStateValue(): StateValue | undefined {
    this.__cache.initialState =
      this.__cache.initialState ||
      ((this.parallel
        ? mapValues(
            this.states as Record<string, StateNode>,
            state => state.initialStateValue
          )
        : this.initial) as StateValue);

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
            events.add(event);
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

export interface MachineFactory {
  (config: MachineConfig | ParallelMachineConfig):
    | StandardMachine
    | ParallelMachine;
  standard: (config: MachineConfig) => StandardMachine;
  parallel: (config: ParallelMachineConfig) => ParallelMachine;
}

export function Machine(
  config: MachineConfig | ParallelMachineConfig
): StandardMachine | ParallelMachine {
  return new StateNode(config) as StandardMachine | ParallelMachine;
}

export { StateNode, State, matchesState, mapState };
