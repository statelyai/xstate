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
  transition: (stateId: string | StatePath | undefined, action: Action) => IState;
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
  } catch(e) {
    throw new Error(`'${stateId}' is not a valid state path.`);
  }
}

function getState(machine: IState, stateId: string | StatePath): IState {
  const statePath = stateId
    ? toStatePath(stateId)
    : toStatePath(machine.initial);
  const stateString: string = Array.isArray(stateId) ? stateId.join(STATE_DELIMITER) : stateId;
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

function getNextState(machine, stateId: string | string[], action?: Action): IState {
  const statePath = toStatePath(stateId);
  const stack = [];
  let currentState: IStateConfig = machine;
  let nextStateId: string;

  for (let stateSubPath of statePath) {
    currentState = currentState.states[stateSubPath];
    stack.push(currentState);
  }

  while (currentState.initial) {
    statePath.push(currentState.initial);
    currentState = currentState.states[currentState.initial];
    stack.push(currentState);
  }

  if (!action) {
    return getState(machine, statePath);
  }

  while (!nextStateId && stack.length) {
    currentState = stack.pop();
    statePath.pop();
    nextStateId = currentState.on[getActionType(action)];
  }

  if (!nextStateId) {
    throw new Error('what the fuck');
  }
  const nextStatePath = toStatePath(nextStateId);
  statePath.push(...nextStatePath);

  return getState(machine, statePath);
}

export function matchesState(parentStateId: string | string[], childStateId: string | string[]): Boolean {
  const parentStatePath = toStatePath(parentStateId);
  const childStatePath = toStatePath(childStateId);

  if (parentStatePath.length > childStatePath.length) return false;

  for (let i in parentStatePath) {
    if (parentStatePath[i] !== childStatePath[i]) return false;
  }

  return true;
}

export default function xstate(machine: IMachineConfig): IMachine {
  let eventsCache;

  return {
    ...machine,
    transition: (stateId, action) => {
      const state = stateId
        ? getState(machine, stateId)
        : getState(machine, machine.initial);

      if (state.final || !state.on) return state;

      return getNextState(machine, stateId || machine.initial, action);
    },
    getState: (stateId) => getState(machine, stateId),
    getEvents: () => eventsCache || (eventsCache = getEvents(machine)),
    get events() {
      return this.getEvents();
    }
  };
}
