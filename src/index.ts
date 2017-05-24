const STATE_DELIMITER = '.';

interface IStateConfig {
  initial?: string;
  final?: boolean;
  states?: {
    [state: string]: IStateConfig;
  };
  on?: {
    [event: string]: string;
  };
}

interface IState extends IStateConfig {
  id: string;
  toString: () => string;
}

interface ITransition extends IState {
  from?: string | string[];
  action?: Action;
}

type Action = string | {
  type: string,
  [key: string]: any,
};

type StatePath = string[];

interface IMachineConfig extends IStateConfig {
  id: string;
  initial: string;
}

interface IMachine extends IState {
  id: string;
  initial: string;
  transition: (stateId: string | StatePath | IState | undefined, action: Action) => ITransition;
  getState: (stateId: string | StatePath | undefined) => IState;
  getEvents: () => string[];
  events: string[];
}

function getActionType(action: Action): string {
  try {
    return typeof action === 'string'
      ? action
      : action.type;
  } catch(e) {
    throw new Error('Actions must be strings or objects with a string action.type.')
  }
}

function toStatePath(stateId: string | StatePath): StatePath {
  try {
    if (Array.isArray(stateId)) return stateId;

    return stateId.split(STATE_DELIMITER);
  } catch (e) {
    throw new Error(`'${stateId}' is not a valid state path.`);
  }
}

function getState(machine: IState, stateId: string | StatePath | IState): IState {
  const statePath = stateId
    ? toStatePath(Array.isArray(stateId) ? stateId : stateId + '')
    : toStatePath(machine.initial);
  const stateString: string = statePath.join(STATE_DELIMITER);
  let currentState: IStateConfig = machine;

  for (let subState of statePath) {
    currentState = currentState.states[subState];
    if (!currentState) throw new Error(`State '${stateId}' does not exist on machine ${machine.id}`);
  }

  return {
    ...currentState,
    id: stateString,
    toString: () => stateString,
  };
}

function getEvents(machine: IStateConfig | IMachineConfig) {
  const eventsMap = {};

  Object.keys(machine.states).forEach(stateId => {
    const state: IStateConfig = machine.states[stateId];
    if (state.states) {
      for (let event of getEvents(state)) {
        if (eventsMap[event]) continue;

        eventsMap[event] = true;
      }
    }
    if (!state.on) return;

    for (let event of Object.keys(state.on)) {
      if (eventsMap[event]) continue;

      eventsMap[event] = true;
    }
  });

  return Object.keys(eventsMap);
}

function getNextState(machine, stateId: string | string[] | IState, action?: Action): ITransition {
  const statePath = toStatePath(Array.isArray(stateId) ? stateId : stateId.toString());
  const stack = [];
  let currentState: IStateConfig = machine;
  let nextStateId: string;

  // Go into the deepest substate represented by the stateId,
  // while remembering the parent states
  for (let stateSubPath of statePath) {
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
  const deepestState = getState(machine, statePath);

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
    nextStateId = currentState.on
      ? currentState.on[actionType]
      : nextStateId;
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

  return getState(machine, statePath);
}

export function matchesState(parentStateId: string | string[], childStateId: string | string[]): boolean {
  const parentStatePath = toStatePath(parentStateId);
  const childStatePath = toStatePath(childStateId);

  if (parentStatePath.length > childStatePath.length) return false;

  for (let i in parentStatePath) {
    if (parentStatePath[i] !== childStatePath[i]) return false;
  }

  return true;
}

export function machine(machine: IMachineConfig): IMachine {
  let eventsCache;

  return {
    ...machine,
    transition: (stateId, action): ITransition => {
      const state = stateId
        ? getState(machine, stateId)
        : getState(machine, machine.initial);

      return getNextState(machine, stateId || machine.initial, action);
    },
    getState: (stateId) => getState(machine, stateId),
    getEvents: () => eventsCache || (eventsCache = getEvents(machine)),
    get events() {
      return this.getEvents();
    }
  };
}
