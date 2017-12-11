import { getActionType, toStatePath, toTrie, mapValues } from './utils';
import {
  Action,
  StateValue,
  StateNodeConfig,
  Transition,
  Effect,
  EntryExitEffectMap
} from './types';
import matchesState from './matchesState';
import mapState from './mapState';
import State from './State';

const STATE_DELIMITER = '.';
const HISTORY_KEY = '$history';

class StateNode<
  TStateKey extends string = string,
  TActionType extends string = string
> {
  public key: string;
  public id: string;
  public relativeId: string;
  public initial?: string;
  public parallel?: boolean;
  public states: Record<TStateKey, StateNode>;
  public on?: Record<TActionType, Transition<TStateKey>>;
  public onEntry?: Effect;
  public onExit?: Effect;
  public parent?: StateNode;
  public machine: StateNode;

  private __cache = {
    events: undefined as string[] | undefined,
    relativeValue: new Map() as Map<StateNode, StateValue>,
    initialState: undefined as StateValue | undefined
  };

  constructor(config: StateNodeConfig<TStateKey, TActionType>) {
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
    this.states = config.states
      ? mapValues(
          config.states,
          (stateConfig, key) =>
            new StateNode({
              ...stateConfig,
              key,
              parent: this
            })
        ) as Record<TStateKey, StateNode<string, string>>
      : {} as Record<TStateKey, StateNode<string, string>>;

    this.on = config.on;
    this.onEntry = config.onEntry;
    this.onExit = config.onExit;
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
    const foo = subStateKeys.map(subStateKey => this.states[subStateKey]);

    return foo.concat(
      subStateKeys
        .map(subStateKey =>
          this.states[subStateKey].getStateNodes(stateValue[subStateKey])
        )
        .reduce((a, b) => a.concat(b))
    );
  }
  public transition(
    state: StateValue | State,
    action: Action,
    extendedState?: any
  ): State | undefined {
    const stateValue = state instanceof State ? state.value : toTrie(state);
    const nextStateValue = this.transitionStateValue(
      state,
      action,
      extendedState
    );

    if (!nextStateValue) {
      return undefined;
    }

    return new State(
      // next state value
      nextStateValue,
      // history
      State.from(state),
      // effects
      this.getEntryExitMap(stateValue, nextStateValue)
    );
  }
  public transitionStateValue(
    state: StateValue | State,
    action: Action,
    extendedState?: any
  ): StateValue | undefined {
    const history = state instanceof State ? state.history : undefined;
    let stateValue = state instanceof State ? state.value : toTrie(state);

    if (typeof stateValue === 'string') {
      if (!this.states[stateValue]) {
        throw new Error(`State ${stateValue} does not exist`);
      }

      const subState = this.states[stateValue] as StateNode;
      const initialState = subState.initialState;

      if (initialState) {
        stateValue = { [stateValue]: initialState };
      } else {
        return subState.next(
          action,
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
      const nextSubStateValue = subStateNode.transitionStateValue(
        subState,
        action,
        extendedState
      );
      return nextSubStateValue;
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
        action,
        history ? history.value : undefined
      );
    }

    if (this.parallel) {
      nextStateValue = { ...(this.initialState as {}), ...nextStateValue };
    }

    const finalStateValue = mapValues(nextStateValue, (value, key) => {
      if (value) {
        return value;
      }

      return stateValue[key];
    });

    return finalStateValue;
  }

  public next(
    action: Action,
    history?: StateValue,
    extendedState?: any
  ): StateValue | undefined {
    const actionType = getActionType(action);

    if (!this.on || !this.on[actionType]) {
      return undefined;
    }

    const transition = this.on[actionType] as Transition;
    let nextStateString: string | undefined;
    if (typeof transition === 'string') {
      nextStateString = transition;
    } else {
      for (const candidate of Object.keys(transition)) {
        const { cond } = transition[candidate];
        if (cond(extendedState, action)) {
          nextStateString = candidate;
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
          `Action '${action}' on state '${currentPath}' leads to undefined state '${nextStatePath}'.`
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

    return currentState.getRelativeValue(this.parent);
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
      return undefined;
    }
  }
  get events(): string[] {
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
  private getEntryExitMap(
    prevStateValue: StateValue,
    nextStateValue: StateValue
  ): EntryExitEffectMap {
    const entry: Effect[] = [];

    const exitEffectMap: Record<string, Effect> = {};

    // Naively set all exit effects
    this.getStateNodes(prevStateValue).forEach(stateNode => {
      if (stateNode.onExit) {
        exitEffectMap[stateNode.id] = stateNode.onExit;
      }
    });

    // Set all entry effects, only if the state is being entered
    this.getStateNodes(nextStateValue).forEach(stateNode => {
      if (exitEffectMap[stateNode.id]) {
        // Remove false exit effects
        delete exitEffectMap[stateNode.id];
      } else if (stateNode.onEntry) {
        entry.push(stateNode.onEntry);
      }
    });

    const exit = Object.keys(exitEffectMap).map(id => exitEffectMap[id]);

    return { entry, exit };
  }
}

function Machine(config: StateNodeConfig): StateNode {
  return new StateNode(config);
}

export { StateNode, Machine, State, matchesState, mapState };
