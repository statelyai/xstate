import { assocIn } from './utils';

const STATE_DELIMITER = '.';

function getActionType(action: xstate.Action): string {
  try {
    return typeof action === 'string' ? action : action.type;
  } catch (e) {
    throw new Error(
      'Actions must be strings or objects with a string action.type.'
    );
  }
}

function toStatePath(stateId: string | xstate.StatePath): xstate.StatePath {
  try {
    if (Array.isArray(stateId)) {
      return stateId;
    }

    return stateId.toString().split(STATE_DELIMITER);
  } catch (e) {
    throw new Error(`'${stateId}' is not a valid state path.`);
  }
}

function getState(
  machine: State,
  stateId: string | State,
  prevState?: string | State
): State {
  const statePath = stateId
    ? toStatePath(Array.isArray(stateId) ? stateId : stateId + '')
    : toStatePath(machine.initial);
  let stateString: string;
  let currentState: xstate.StateConfig = machine;
  let historyMarker =
    prevState instanceof State ? prevState.history : machine.history;

  for (let subStatePath of statePath) {
    if (subStatePath === '$history') {
      subStatePath = historyMarker.current;
    }

    stateString = stateString
      ? stateString + STATE_DELIMITER + subStatePath
      : subStatePath;
    historyMarker = historyMarker.states[subStatePath];

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

  return new State(currentState, machine.history);
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

function getNextParallelStates(
  machine: State,
  stateIds: Array<string | State>,
  action?: xstate.Action
): State[] {
  return stateIds.map(stateId => getNextState(machine, stateId, action));
}

function getNextState(
  machine,
  stateId: string | State,
  action?: xstate.Action
): State {
  const statePath = stateId
    ? toStatePath(Array.isArray(stateId) ? stateId : stateId.toString())
    : toStatePath(machine.initial);
  const stack = [];
  let currentState: xstate.StateConfig = machine;
  let nextStateId: string;

  // Go into the deepest substate represented by the stateId,
  // while remembering the parent states
  for (const stateSubPath of statePath) {
    currentState = currentState.states[stateSubPath];
    stack.push(currentState);
  }

  // If the deepest substate has an initial state (hierarchical),
  // go into that initial state.
  while (currentState.initial) {
    statePath.push(currentState.initial);
    currentState = currentState.states[currentState.initial];
    stack.push(currentState);
  }

  // We are currently at the deepest state. Save it.
  const deepestState = getState(machine, statePath.join(STATE_DELIMITER));

  // If there is no action, the deepest substate is our current state.
  if (!action) {
    return deepestState;
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
    return deepestState;
  }

  // The resulting next state path is a combination of the determined
  // next state path (which is contextual; e.g., 'three.four')
  // and the current state path (e.g., ['one', 'two'])
  // => ['one', 'two', 'three', 'four']
  const nextStatePath = toStatePath(nextStateId);
  statePath.push(...nextStatePath);

  const nextState = getState(machine, statePath.join(STATE_DELIMITER), stateId);

  return new State(nextState, updateHistory(machine.history, deepestState.id));
}

export function matchesState(
  parentStateId: string | string[],
  childStateId: string | string[]
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
  stateId: xstate.StateId
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
    current: config.initial,
    states: {}
  };

  Object.keys(config.states).forEach(stateId => {
    const state = config.states[stateId];

    if (!state.states) {
      return;
    }

    history.states[stateId] = createHistory(state);
  });

  return history;
}

function updateHistory(
  history: xstate.History,
  stateId: string
): xstate.History {
  const statePath = toStatePath(stateId);
  const newHistory = Object.assign({}, history);
  let marker = newHistory;

  for (let i = 0; i < statePath.length - 1; i++) {
    const subStatePath = statePath[i];
    marker.states = Object.assign({}, marker.states);
    marker.states[subStatePath] = {
      current: statePath[i + 1],
      states: Object.assign({}, marker.states[subStatePath].states)
    };

    marker = marker.states[subStatePath];
  }

  return newHistory;
}

export class State {
  public id: string;
  public initial?: string;
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
    this.states = {};
    this.history = history || createHistory(config);
    if (config.states) {
      Object.keys(config.states).forEach(stateId => {
        const stateConfig = config.states[stateId];
        this.states[stateId] = new State({
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
  public transition(stateId: string | State, action?: xstate.Action): State;
  public transition(
    stateIds: string[] | State[],
    action?: xstate.Action
  ): State[];
  public transition(stateId, action) {
    if (Array.isArray(stateId)) {
      return stateId.map(parallelStateid =>
        getNextState(this, parallelStateid, action)
      );
    }

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

// tslint:disable:max-classes-per-file
export class Machine extends State {
  constructor(config: xstate.StateConfig, history?: xstate.History) {
    super({ ...config, isMachine: true }, history);
  }
}
