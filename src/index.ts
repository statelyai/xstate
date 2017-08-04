import { assocIn, flatMap } from './utils';
import { Action } from './types';

const STATE_DELIMITER = '.';

function getActionType(action: Action): string {
  try {
    return typeof action === 'string' || typeof action === 'number'
      ? `${action}`
      : action.type;
  } catch (e) {
    throw new Error(
      'Actions must be strings or objects with a string action.type.'
    );
  }
}

function toStatePath(stateId: string | State | string[]): string[] {
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

function getState(
  machine: Node,
  stateId: StateId | string[],
  history: xstate.History = machine.history
): Node {
  const statePath = stateId
    ? toStatePath(Array.isArray(stateId) ? stateId : stateId + '')
    : toStatePath(machine.initial);
  const absolutePath = machine.getRelativePath();
  let stateString: string;
  let currentState = machine;

  for (let subStatePath of statePath) {
    if (subStatePath === '$history') {
      subStatePath = (absolutePath.reduce((subHistory, subPath) => {
        return subHistory[subPath];
      }, history) as xstate.History).$current;
    }

    stateString = stateString
      ? stateString + STATE_DELIMITER + subStatePath
      : subStatePath;
    absolutePath.push(subStatePath);

    currentState = currentState.states[subStatePath];
    if (!currentState) {
      throw new Error(
        `State '${stateId}' does not exist on parent ${machine.id}`
      );
    }
  }

  while (currentState.initial) {
    stateString += STATE_DELIMITER + currentState.initial;
    currentState = currentState.states[currentState.initial];
    if (!currentState) {
      throw new Error(
        `Initial state '${stateString}' does not exist on parent.`
      );
    }
  }

  return new Node(currentState, machine.history);
}

function getEvents(machine: Node) {
  const events = new Set(machine.on ? Object.keys(machine.on) : undefined);

  Object.keys(machine.states).forEach(stateId => {
    const state = machine.states[stateId];
    if (state.states) {
      const stateEvents = getEvents(state);
      for (const event of stateEvents) {
        events.add(event);
      }
    }
  });

  return Array.from(events);
}

type StateId = string | State;

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

function fff(
  parent: Node,
  stateValue: StateValue,
  action?: Action
): StateValue {
  if (typeof stateValue === 'string') {
    const state = parent.states[stateValue];
    return state.next(action) || state.getInitialState() || undefined;
  }

  if (Object.keys(stateValue).length === 1) {
    const subStateKey = Object.keys(stateValue)[0];
    const subState = parent.states[subStateKey];
    return (
      // first try deep
      fff(subState, stateValue[subStateKey], action) ||
      // then try shallow
      subState.next(action) ||
      // finally, stick with initial state value
      stateValue[subStateKey]
    );
  }

  let nextValue = {};
  let willTransition = false;
  const untransitionedKeys = {};
  Object.keys(stateValue).forEach(key => {
    const subValue = fff(parent.states[key], stateValue[key], action);
    if (subValue) {
      nextValue[key] = subValue;
      willTransition = true;
    } else {
      nextValue[key] = undefined;
      untransitionedKeys[key] = stateValue[key];
    }
  });

  if (willTransition) {
    Object.assign(nextValue, untransitionedKeys);
  } else {
    nextValue = undefined;
  }

  return nextValue;
}

function getNextState(
  machine: Node,
  stateValue: StateValue | State,
  action?: Action,
  history: xstate.History = machine.history
): State {
  if (typeof stateValue === 'object' && !(stateValue instanceof State)) {
    const nextValue = fff(machine, stateValue, action) || stateValue;

    return new State({
      value: nextValue,
      history,
      changed: true
    });
  }

  const statePath = toStatePath(stateValue);
  const fromState = getState(machine, statePath, history);
  let currentState = fromState;

  if (!action) {
    return new State({
      value: fromState.getRelativeId(machine),
      history,
      changed: false
    });
  }

  const actionType = getActionType(action);

  while (currentState && !currentState.accepts(actionType)) {
    currentState = currentState.parent;
  }

  if (!currentState || !currentState.on || !currentState.on[actionType]) {
    // tslint:disable-next-line:no-console
    console.warn(
      `No transition exists for ${fromState.id} on action ${actionType}.`
    );
    return new State({
      value: fromState.getRelativeId(machine),
      history,
      changed: false
    });
  }

  const nextStatePath = toStatePath(currentState.on[actionType]);

  const nextNode = getState(
    currentState.parent || currentState,
    nextStatePath,
    history
  );
  let nodeMarker = nextNode;
  let nextValue: StateValue = nextNode.getInitialState()
    ? { [nextNode.id]: nextNode.getInitialState() }
    : nextNode.id;
  let parallel = nextNode.parallel;

  while (nodeMarker.parent && nodeMarker.parent !== machine) {
    nodeMarker = nodeMarker.parent;
    if (nodeMarker.parallel) {
      parallel = true;
      nextValue = {
        [nodeMarker.id]: mapValues(nodeMarker.states, (subNode, key) => {
          return nextValue[key] || subNode.getInitialState();
        })
      };
    } else {
      nextValue = { [nodeMarker.id]: nextValue };
    }
  }

  if (!parallel && typeof nextValue !== 'string') {
    let m: StateValue = nextValue;
    const p: string[] = [];

    while (m && typeof m !== 'string') {
      p.push(Object.keys(m)[0]);
      m = m[Object.keys(m)[0]];
    }

    p.push(m as string);

    nextValue = p.join(STATE_DELIMITER);
  }

  return new State({
    value: nextValue,
    history: updateHistory(history, fromState.getRelativeId(machine)),
    changed: true
  });
}

export function matchesState(
  parentStateId: StateId,
  childStateId: StateId
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

function updateHistory(
  history: xstate.History,
  stateId: string | string[]
): xstate.History {
  const statePath = toStatePath(stateId);
  const newHistory = Object.assign({}, history);
  const [first, ...last] = statePath;
  let result;

  if (!last.length) {
    result = assocIn(history, ['$current'], first);
  } else {
    result = assocIn(history, ['$current'], first);
    result = assocIn(result, [first], updateHistory(result[first], last));
  }
  return result;
}

interface IStateValueMap {
  [key: string]: StateValue;
}
type StateValue = string | IStateValueMap;

// tslint:disable:max-classes-per-file
export class State {
  public value: StateValue;
  public history: xstate.History;
  public changed: boolean;
  constructor({ value, history, changed }) {
    this.value = value;
    this.history = history;
    this.changed = changed;
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

export class Node {
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
    const stateValue =
      (state instanceof State ? state.value : state) || this.getInitialState();
    const history = state instanceof State ? state.history : undefined;

    return getNextState(this, stateValue, action, history);
  }
  public next(action?: Action): StateValue | undefined {
    if (!action) {
      return undefined;
    }

    const actionType = getActionType(action);

    if (!this.on || !this.on[actionType]) {
      return undefined;
    }

    return this.on[actionType];
  }
  public willTransition(action: Action, stateValue?: StateValue): boolean {
    if (this.on && this.on[getActionType(action)]) {
      return true;
    }

    if (!stateValue) {
      return false;
    }

    return Object.keys(stateValue).some(key => {
      const subState = this.states[key];

      return subState && subState.willTransition(action, stateValue[key]);
    });
  }
  public getInitialState(): StateValue {
    if (this.parallel) {
      return mapValues(this.states, state => state.getInitialState());
    }

    return this.initial;
  }
  public getState(stateId) {
    return getState(this, stateId);
  }
  public accepts(action?: Action): boolean {
    return this.events.indexOf(getActionType(action)) !== -1;
  }
  get events() {
    return getEvents(this);
  }
  public toString(): string {
    return this.id;
  }
  public getRelativePath(toNode?: Node): string[] {
    const relativePath = [];
    let currentNode: Node = this;

    while (currentNode && currentNode !== toNode) {
      if (toNode || currentNode.parent) {
        relativePath.unshift(currentNode.id);
      }

      currentNode = currentNode.parent;
    }

    return relativePath;
  }
  public getRelativeId(toNode?: Node): string {
    const path = this.getRelativePath(toNode);

    return path.join(STATE_DELIMITER);
  }
}

export class Machine extends Node {
  constructor(config: INodeConfig, history?: xstate.History) {
    super(config, history);
  }
}
