import { assocIn, flatMap } from './utils';
import { Action } from './types';

const STATE_DELIMITER = '.';

function getActionType(action: Action): string {
  try {
    return typeof action === 'string' ? action : action.type;
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
  history?: xstate.History
): Node {
  const statePath = stateId
    ? toStatePath(Array.isArray(stateId) ? stateId : stateId + '')
    : toStatePath(machine.initial);
  let stateString: string;
  let currentState = machine;
  let historyMarker = history || machine.history;

  for (let subStatePath of statePath) {
    if (subStatePath === '$history') {
      subStatePath = historyMarker.$current;
    }

    stateString = stateString
      ? stateString + STATE_DELIMITER + subStatePath
      : subStatePath;
    historyMarker = historyMarker[subStatePath] as xstate.History;

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

function getNextStates(
  machine: Machine,
  statePath: string[],
  action: Action,
  history: xstate.History
): State {
  const initialState = getState(machine, statePath, history);
  let currentState = initialState;

  if (!action) {
    return new State({
      value: initialState.getRelativeId(machine),
      history,
      changed: false
    });
  }

  const actionType = getActionType(action);

  while (currentState && !currentState.accepts(actionType)) {
    currentState = currentState.parent;
  }

  if (!currentState) {
    // tslint:disable-next-line:no-console
    console.warn(
      `No transition exists for ${initialState.id} on action ${actionType}.`
    );
    return new State({
      value: initialState.getRelativeId(machine),
      history,
      changed: false
    });
  }

  const nextState = getState(
    currentState.parent,
    currentState.on[actionType],
    history
  );

  return new State({
    value: nextState.getRelativeId(machine),
    history: updateHistory(history, currentState.id),
    changed: true
  });
}

function getNextState(
  machine: Node,
  stateValue: StateValue | State,
  action?: Action
): State {
  if (typeof stateValue === 'object' && !(stateValue instanceof State)) {
    const value = mapValues(stateValue, (subStateValue, stateId) => {
      const subState = machine.states[stateId];

      return subState.transition(stateValue[stateId], action).value;
    });

    return new State({
      value,
      history: machine.history,
      changed: true
    });
  }

  const statePath = toStatePath(stateValue);
  let history = machine.history;

  if (stateValue instanceof State) {
    history = stateValue.history || history;
  }

  return getNextStates(machine, statePath, action, history);
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
  stateId: string
): xstate.History {
  const statePath = toStatePath(stateId);
  const newHistory = Object.assign({}, history);
  const first = statePath.slice(0, -1);
  const last = statePath[statePath.length - 1];

  if (!first.length) {
    return assocIn(history, ['$current'], last);
  }
  return assocIn(history, first, { $current: last });
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
}

interface INodeConfig {
  initial?: string;
  states?: {
    [state: string]: INodeConfig;
  };
  parallel?: boolean;
  isMachine?: boolean;
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
    return getNextState(this, stateValue, action);
  }
  public getInitialState() {
    if (this.parallel) {
      return mapValues(this.states, state => state.getInitialState());
    }

    return this.initial;
  }
  public getState(stateId) {
    return getState(this, stateId);
  }
  public accepts(action?: Action): boolean {
    console.log(
      `${this.id} accepts ${getActionType(action)}?`,
      this.events.indexOf(getActionType(action)) !== -1
    );
    return this.events.indexOf(getActionType(action)) !== -1;
  }
  get events() {
    return getEvents(this);
  }
  public toString(): string {
    return this.id;
  }
  public getRelativeId(toNode: Node): string {
    let relativeId = this.id;
    let currentNode = this.parent;
    while (currentNode && currentNode !== toNode) {
      relativeId = currentNode.id + STATE_DELIMITER + relativeId;
      currentNode = currentNode.parent;
    }

    return relativeId;
  }
}

export class Machine extends Node {
  constructor(config: INodeConfig, history?: xstate.History) {
    super({ ...config, isMachine: true }, history);
  }
}
