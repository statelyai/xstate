import { getActionType, toStatePath, toTrie, mapValues } from './utils';
import { Action, StateValue, IStateNodeConfig, IHistory } from './types';
import matchesState from './matchesState';
import mapState from './mapState';
import State from './State';
import { createHistory, updateHistory } from './history';

const STATE_DELIMITER = '.';
const HISTORY_KEY = '$history';

function getNextStateValue(
  parent: StateNode,
  stateValue: StateValue,
  action?: Action,
  history: IHistory = parent.history
): StateValue {
  if (typeof stateValue === 'string') {
    const state = parent.states[stateValue];
    const initialState = state.initialState;

    if (initialState) {
      stateValue = {
        [stateValue]: initialState
      };
    } else {
      return state.next(action, history) || undefined;
    }
  }

  if (parent.parallel) {
    const initialState = parent.initialState;

    if (typeof initialState !== 'string') {
      stateValue = {
        ...initialState,
        ...stateValue
      };
    }
  }

  if (Object.keys(stateValue).length === 1) {
    const subStateKey = Object.keys(stateValue)[0];
    const subState = parent.states[subStateKey];
    const subStateValue = stateValue[subStateKey];
    const subHistory = history[subStateKey];

    const nextStateValue = getNextStateValue(
      subState,
      subStateValue,
      action,
      subHistory as IHistory
    );

    if (nextStateValue) {
      return { [subStateKey]: nextStateValue };
    }

    return subState.next(action, history);
  }

  const nextValue = {};
  let willTransition = false;
  const untransitionedKeys: Record<string, StateValue> = {};
  Object.keys(stateValue).forEach(key => {
    const subValue = getNextStateValue(
      parent.states[key],
      stateValue[key],
      action,
      history[key] as IHistory
    );

    if (subValue) {
      nextValue[key] = subValue;
      willTransition = true;
    } else {
      nextValue[key] = undefined;
      untransitionedKeys[key] = stateValue[key];
    }
  });

  return willTransition
    ? Object.assign(nextValue, untransitionedKeys) as StateValue
    : undefined;
}

class StateNode {
  public key?: string;
  public id: string;
  public initial?: string;
  public parallel?: boolean;
  public history: IHistory;
  public states?: Record<string, StateNode>;
  public on?: Record<string, string>;
  public parent?: StateNode;

  private _events?: string[];
  private _relativeValue: Map<StateNode, StateValue> = new Map();
  private _initialState: StateValue | undefined;
  constructor(config: IStateNodeConfig, history?: IHistory) {
    this.key = config.key;
    this.parent = config.parent;
    this.id = this.parent
      ? this.parent.id + STATE_DELIMITER + this.key
      : this.key;
    this.initial = config.initial;
    this.parallel = !!config.parallel;
    this.history = history || createHistory(config);
    this.states = config.states
      ? mapValues(
          config.states,
          (stateConfig, key) =>
            new StateNode(
              {
                ...stateConfig,
                key,
                parent: this
              },
              history
            )
        )
      : {};

    this.on = config.on;
  }
  public transition(
    state: StateValue | State,
    action: Action
  ): State | undefined {
    const stateValue = toTrie(state instanceof State ? state.value : state);
    const history = state instanceof State ? state.history : this.history;
    const nextStateValue = getNextStateValue(this, stateValue, action, history);

    if (!nextStateValue) {
      return undefined;
    }

    return new State(nextStateValue, updateHistory(history, stateValue));
  }
  // public _transition(state: StateValue | State, action: Action): State | undefined {

  // }
  public next(action?: Action, history?: IHistory): StateValue | undefined {
    if (!action) {
      return this.key;
    }

    const actionType = getActionType(action);

    if (!this.on || !this.on[actionType]) {
      return undefined;
    }

    const nextPath = toStatePath(this.on[actionType]);
    let currentState = this.parent;
    let currentHistory = history;

    nextPath.forEach(subPath => {
      if (subPath === HISTORY_KEY) {
        subPath = currentHistory.$current as string;
      }
      if (typeof subPath === 'object') {
        subPath = Object.keys(subPath)[0];
      }

      currentState = currentState.states[subPath];
      currentHistory = currentHistory[subPath] as IHistory;
    });

    while (currentState.initial) {
      currentState = currentState.states[currentState.initial];
    }

    return currentState.getRelativeValue(this.parent);
  }
  public getInitialState(): StateValue | undefined {
    console.warn(
      'machine.getInitialState() will be deprecated in 2.0. Please use machine.initialState instead.'
    );
    return this.initialState;
  }
  public get initialState(): StateValue | undefined {
    this._initialState =
      this._initialState ||
      (this.parallel
        ? mapValues(this.states, state => state.initialState)
        : this.initial);

    return this._initialState;
  }
  public getState(relativeStateId: string): StateNode | undefined {
    const statePath = toStatePath(relativeStateId);

    try {
      return statePath.reduce(
        (subState, subPath) => {
          return subState.states[subPath];
        },
        this as StateNode
      );
    } catch (e) {
      return undefined;
    }
  }
  get events(): string[] {
    if (this._events) {
      return this._events;
    }

    const events = new Set(this.on ? Object.keys(this.on) : undefined);

    Object.keys(this.states).forEach(stateId => {
      const state = this.states[stateId];
      if (state.states) {
        for (const event of state.events) {
          events.add(event);
        }
      }
    });

    return (this._events = Array.from(events));
  }
  public getRelativeValue(toNode?: StateNode): StateValue {
    const memoizedRelativeValue = this._relativeValue.get(toNode);

    if (memoizedRelativeValue) {
      return memoizedRelativeValue;
    }

    const initialState = this.initialState;
    let relativeValue = initialState
      ? {
          [this.key]: initialState
        }
      : this.key;
    let currentNode: StateNode = this.parent;

    while (currentNode && currentNode !== toNode) {
      const currentInitialState = currentNode.initialState;
      relativeValue = {
        [currentNode.key]:
          typeof currentInitialState === 'object' &&
          typeof relativeValue === 'object'
            ? { ...currentInitialState, ...relativeValue }
            : relativeValue
      };
      currentNode = currentNode.parent;
    }

    this._relativeValue.set(toNode, relativeValue);

    return relativeValue;
  }
}

function Machine(config: IStateNodeConfig): StateNode {
  return new StateNode(config);
}

export { StateNode, Machine, State, matchesState, mapState };
