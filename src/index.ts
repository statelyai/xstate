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

function toStatePath(stateId: string | State): string[] {
  try {
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
  stateId: StateId,
  history?: xstate.History
): Node {
  const statePath = stateId
    ? toStatePath(Array.isArray(stateId) ? stateId : stateId + '')
    : toStatePath(machine.initial);
  let stateString: string;
  let currentState: xstate.StateConfig = machine;
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

function getEvents(machine: xstate.StateConfig) {
  const eventsMap = {};

  Object.keys(machine.states).forEach(stateId => {
    const state: xstate.StateConfig = machine.states[stateId];
    if (state.states) {
      for (const event of getEvents(state)) {
        if (eventsMap[event]) {
          continue;
        }

        eventsMap[event] = true;
      }
    }
    if (!state.on) {
      return;
    }

    for (const event of Object.keys(state.on)) {
      if (eventsMap[event]) {
        continue;
      }

      eventsMap[event] = true;
    }
  });

  return Object.keys(eventsMap);
}

type StateId = string | State;

const getNextStates = (
  statePath: string[],
  machine: Machine,
  history: xstate.History,
  action: Action
): State => {
  const stack = [];
  let currentState: xstate.StateConfig = machine;
  let nextStateId: string;

  // Go into the deepest substate represented by the stateId,
  // while remembering the parent states
  for (const stateSubPath of statePath) {
    currentState = currentState.states[stateSubPath];
    stack.push(currentState);
  }

  if (currentState.parallel) {
    const result = flatMap(Object.keys(currentState.states), subStatePath =>
      getNextStates([...statePath, subStatePath], machine, history, action)
    );

    return new State({
      id: flatMap(result, state => state.id),
      history,
      changed: true
    });
  }

  // If the deepest substate has an initial state (hierarchical),
  // go into that initial state.
  while (currentState.initial) {
    statePath.push(currentState.initial);
    currentState = currentState.states[currentState.initial];
    stack.push(currentState);
  }

  // We are currently at the deepest state. Save it.
  const deepestState = getState(
    machine,
    statePath.join(STATE_DELIMITER),
    history
  );

  // If there is no action, the deepest substate is our current state.
  if (!action) {
    return new State({ id: deepestState.id, history, changed: false });
  }

  const actionType = getActionType(action);

  // At first, the current state is the deepest substate that doesn't have
  // any substates (no initial state).
  // For each state, see if there is a valid transition.
  // - If there is, that is our next state ID.
  // - If there is not, continue by looking in the parent state.
  while (!nextStateId && stack.length) {
    currentState = stack.pop();
    statePath.pop();
    nextStateId = currentState.on ? currentState.on[actionType] : nextStateId;
  }

  // No transition exists for the given action and state.
  if (!nextStateId) {
    return new State({ id: deepestState.id, history, changed: false });
  }

  // The resulting next state path is a combination of the determined
  // next state path (which is contextual; e.g., 'three.four')
  // and the current state path (e.g., ['one', 'two'])
  // => ['one', 'two', 'three', 'four']
  const nextStatePath = toStatePath(nextStateId);
  statePath.push(...nextStatePath);

  const nextState = getState(machine, statePath.join(STATE_DELIMITER), history);

  return new State({
    id: nextState.id,
    history: updateHistory(history, deepestState.id),
    changed: true
  });
};

function getNextState(
  machine,
  stateId: StateId | StateId[],
  action?: Action
): State {
  const statePaths = Array.isArray(stateId)
    ? stateId.map(toStatePath)
    : stateId
      ? stateId instanceof State
        ? [].concat(stateId.id).map(toStatePath)
        : [toStatePath(stateId)]
      : machine.parallel
        ? Object.keys(machine.states).map(key => [key])
        : [toStatePath(machine.initial)];
  let history = machine.history;

  if (stateId) {
    const sampleState = Array.isArray(stateId) ? stateId[0] : stateId;
    if (sampleState instanceof State) {
      history = sampleState.history || history;
    }
  }

  const result = flatMap(statePaths, statePath =>
    getNextStates(statePath, machine, history, action)
  );

  return new State({
    id: flatMap(result, state => state.id),
    history: result[0].history,
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

// tslint:disable:max-classes-per-file
class State {
  public id: string | string[];
  public history: xstate.History;
  public changed: boolean;
  constructor({ id, history, changed }) {
    this.id = id;
    this.history = history;
    this.changed = changed;
  }
}

class Node {
  public id: string;
  public initial?: string;
  public parallel?: boolean;
  public history: xstate.History;
  public states?: {
    [state: string]: xstate.StateConfig;
  };
  public on?: {
    [event: string]: string;
  };
  constructor(config: xstate.StateConfig, history?: xstate.History) {
    this.id = config.id;
    this.initial = config.initial;
    this.parallel = !!config.parallel;
    this.states = {};
    this.history = history || createHistory(config);
    if (config.states) {
      Object.keys(config.states).forEach(stateId => {
        const stateConfig = config.states[stateId];
        this.states[stateId] = new Node({
          ...stateConfig,
          id: config.isMachine
            ? stateId
            : config.id + STATE_DELIMITER + stateId,
          history: this.history
        });
      });
    }

    this.on = config.on;
  }
  public transition(stateId: StateId | StateId[], action?: Action): State;
  public transition(stateId, action) {
    return getNextState(this, stateId, action);
  }
  public getState(stateId) {
    return getState(this, stateId);
  }
  get events() {
    return getEvents(this);
  }
  public toString(): string {
    return this.id;
  }
}

export class Machine extends Node {
  constructor(config: xstate.StateConfig, history?: xstate.History) {
    super({ ...config, isMachine: true }, history);
  }
}
