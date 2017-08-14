import {
  assocIn,
  flatMap,
  getActionType,
  toStatePath,
  toTrie,
  mapValues
} from './utils';
import { Action, StateKey, StateValue } from './types';
import matchesState from './matchesState';
import mapState from './mapState';
import State from './State';

const STATE_DELIMITER = '.';
const HISTORY_KEY = '$history';

function getNextStateValue(
  parent: Node,
  stateValue: StateValue,
  action?: Action,
  history: xstate.History = parent.history
): StateValue {
  if (typeof stateValue === 'string') {
    const state = parent.states[stateValue];
    const initialState = state.getInitialState();

    if (initialState) {
      stateValue = {
        [stateValue]: initialState
      };
    } else {
      return state.next(action, history) || undefined;
    }
  }

  if (parent.parallel) {
    const initialState = parent.getInitialState();

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

    const nextValue = getNextStateValue(
      subState,
      subStateValue,
      action,
      subHistory as xstate.History
    );

    if (nextValue) {
      return { [subStateKey]: nextValue };
    }

    return subState.next(action, history);
  }

  const nextValue = {};
  let willTransition = false;
  const untransitionedKeys = {};
  Object.keys(stateValue).forEach(key => {
    const subValue = getNextStateValue(
      parent.states[key],
      stateValue[key],
      action,
      history[key] as xstate.History
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

export function createHistory(
  config: xstate.StateConfig
): xstate.History | undefined {
  if (!config.states) {
    return undefined;
  }

  const history = {
    $current: config.initial
  };

  Object.keys(config.states).forEach(stateId => {
    const state = config.states[stateId];

    if (!state.states) {
      return;
    }

    history[stateId] = createHistory(state);
  });

  return history;
}

interface IHistory {
  $current: StateValue;
  [key: string]: IHistory | StateValue; // TODO: remove string
}

function updateHistory(
  history: xstate.History,
  stateValue: StateValue
): IHistory {
  if (typeof stateValue === 'string') {
    return {
      ...history,
      $current: stateValue
    };
  }

  const nextHistory = {
    ...history,
    $current: stateValue
  };

  Object.keys(stateValue).forEach(subStatePath => {
    const subHistory = history[subStatePath] as string;
    const subStateValue = stateValue[subStatePath];

    if (typeof subHistory === 'string') {
      // this will never happen, just making TS happy
      return;
    }

    nextHistory[subStatePath] = updateHistory(subHistory, subStateValue);
  });

  return nextHistory;
}

// tslint:disable:max-classes-per-fil

interface INodeConfig {
  initial?: string;
  states?: Record<string, INodeConfig>;
  parallel?: boolean;
  id?: string;
  on?: Record<string, string>;
  parent?: Node;
}

class Node {
  public id: string;
  public initial?: string;
  public parallel?: boolean;
  public history: xstate.History;
  public states?: Record<string, Node>;
  public on?: Record<string, string>;
  public parent?: Node;

  private _events?: string[];
  private _relativeValue: Map<Node, StateValue> = new Map();
  private _initialState: StateValue | undefined;
  constructor(config: INodeConfig, history?: xstate.History) {
    this.id = config.id;
    this.parent = config.parent;
    this.initial = config.initial;
    this.parallel = !!config.parallel;
    this.states = config.states
      ? mapValues(
          config.states,
          (stateConfig, stateId) =>
            new Node(
              {
                ...stateConfig,
                id: stateId,
                parent: this
              },
              this.history
            )
        )
      : {};
    this.history = history || createHistory(config);

    this.on = config.on;
  }
  public transition(state?: StateValue | State, action?: Action): State {
    let stateValue =
      (state instanceof State ? state.value : state) || this.getInitialState();
    const history = state instanceof State ? state.history : this.history;

    stateValue = toTrie(stateValue);

    const nextValue =
      getNextStateValue(this, stateValue, action, history) ||
      getNextStateValue(this, stateValue, undefined, history);

    return new State({
      value: nextValue,
      history: updateHistory(history, stateValue),
      changed: true
    });
  }
  public next(
    action?: Action,
    history?: xstate.History
  ): StateValue | undefined {
    if (!action) {
      return this.id;
    }

    const actionType = getActionType(action);

    if (!this.on || !this.on[actionType]) {
      return undefined;
    }

    const nextPath = toStatePath(this.on[actionType]);
    let currentState = this.parent;
    let currentHistory = history;

    nextPath.forEach(subPath => {
      if (subPath === '$history') {
        subPath = currentHistory.$current;
      }
      if (typeof subPath === 'object') {
        subPath = Object.keys(subPath)[0];
      }

      currentState = currentState.states[subPath];
      currentHistory = currentHistory[subPath] as xstate.History;
    });

    while (currentState.initial) {
      currentState = currentState.states[currentState.initial];
    }

    return currentState.getRelativeValue(this.parent);
  }
  public getInitialState(): StateValue | undefined {
    let initialState = this._initialState;

    if (initialState) {
      return initialState;
    }

    initialState = this.parallel
      ? mapValues(this.states, state => state.getInitialState())
      : this.initial;

    return (this._initialState = initialState);
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
  public getRelativeValue(toNode?: Node): StateValue {
    const memoizedRelativeValue = this._relativeValue.get(toNode);

    if (memoizedRelativeValue) {
      return memoizedRelativeValue;
    }

    const initialState = this.getInitialState();
    let relativeValue = initialState
      ? {
          [this.id]: initialState
        }
      : this.id;
    let currentNode: Node = this.parent;

    while (currentNode && currentNode !== toNode) {
      const currentInitialState = currentNode.getInitialState();
      relativeValue = {
        [currentNode.id]:
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

export { Node, Node as Machine, State, matchesState, mapState };
