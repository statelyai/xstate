import { assocIn, flatMap, getActionType } from './utils';
import { Action, StateKey } from './types';

const STATE_DELIMITER = '.';
const HISTORY_KEY = '$history';

export function toStatePath(stateId: string | State | string[]): string[] {
  try {
    if (Array.isArray(stateId)) {
      return stateId;
    }
    if (stateId instanceof Node) {
      return toStatePath(stateId.id);
    }

    return stateId.toString().split(STATE_DELIMITER);
  } catch (e) {
    throw new Error(`'${stateId}' is not a valid state path.`);
  }
}

export function matchesState(
  parentStateId: StateKey,
  childStateId: StateKey
): boolean {
  const parentStatePath = toStatePath(parentStateId);
  const childStatePath = toStatePath(childStateId);

  if (parentStatePath.length > childStatePath.length) {
    return false;
  }

  for (const i in parentStatePath) {
    if (parentStatePath[i] !== childStatePath[i]) {
      return false;
    }
  }

  return true;
}

function getEvents(machine: Node) {
  const events = new Set(machine.on ? Object.keys(machine.on) : undefined);

  Object.keys(machine.states).forEach(stateId => {
    const state = machine.states[stateId];
    if (state.states) {
      for (const event of getEvents(state)) {
        events.add(event);
      }
    }
  });

  return Array.from(events);
}

function mapValues<T, P>(
  collection: { [key: string]: T },
  iteratee: (item: T, key: string, collection: { [key: string]: T }) => P
): { [key: string]: P } {
  const result = {};

  Object.keys(collection).forEach(key => {
    result[key] = iteratee(collection[key], key, collection);
  });

  return result;
}

function getStatePaths(stateValue: StateValue): string[][] {
  if (typeof stateValue === 'string') {
    return [[stateValue]];
  }

  const subPaths = Object.keys(stateValue)
    .map(key => {
      return getStatePaths(stateValue[key]).map(subPath => [key, ...subPath]);
    })
    .reduce((a, b) => a.concat(b), []);

  return subPaths;
}

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

function toTrie(stateValue: StateValue | State): StateValue {
  if (typeof stateValue === 'object' && !(stateValue instanceof State)) {
    return stateValue;
  }

  const statePath = toStatePath(stateValue);
  if (statePath.length === 1) {
    return statePath[0];
  }

  const value = {};
  let marker = value;

  for (let i = 0; i < statePath.length - 1; i++) {
    if (i === statePath.length - 2) {
      marker[statePath[i]] = statePath[i + 1];
    } else {
      marker[statePath[i]] = {};
      marker = marker[statePath[i]];
    }
  }

  return value;
}

export function mapState(
  stateMap: { [stateId: string]: any },
  stateId: string
) {
  let foundStateId;

  Object.keys(stateMap).forEach(mappedStateId => {
    if (
      matchesState(mappedStateId, stateId) &&
      (!foundStateId || stateId.length > foundStateId.length)
    ) {
      foundStateId = mappedStateId;
    }
  });

  return stateMap[foundStateId];
}

function createHistory(config: xstate.StateConfig): xstate.History | undefined {
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

interface IStateValueMap {
  [key: string]: StateValue;
}
type StateValue = string | IStateValueMap;

// tslint:disable:max-classes-per-file
class State {
  public value: StateValue;
  public history: xstate.History;
  public changed: boolean;
  constructor({ value, history, changed }) {
    this.value = value;
    this.history = history;
    this.changed = changed;
  }
  public toString(): string | undefined {
    if (typeof this.value === 'string') {
      return this.value;
    }

    const path = [];
    let marker: StateValue = this.value;

    while (true) {
      if (typeof marker === 'string') {
        path.push(marker);
        break;
      }

      const [firstKey, ...otherKeys] = Object.keys(marker);

      if (otherKeys.length) {
        return undefined;
      }

      path.push(firstKey);
      marker = marker[firstKey];
    }

    return path.join(STATE_DELIMITER);
  }
}

interface INodeConfig {
  initial?: string;
  states?: {
    [state: string]: INodeConfig;
  };
  parallel?: boolean;
  id?: string;
  on?: {
    [action: string]: string;
  };
  parent?: Node;
}

class Node {
  public id: string;
  public initial?: string;
  public parallel?: boolean;
  public history: xstate.History;
  public states?: {
    [state: string]: Node;
  };
  public on?: {
    [event: string]: string;
  };
  public parent?: Node;
  // tslint:disable-next-line:variable-name
  private _events?: string[];
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
    if (this.parallel) {
      return mapValues(this.states, state => state.getInitialState());
    }

    return this.initial;
  }
  get events() {
    return this._events || (this._events = getEvents(this));
  }
  public getRelativeValue(toNode?: Node): StateValue {
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

    return relativeValue;
  }
}

export { Node as Machine, State };
