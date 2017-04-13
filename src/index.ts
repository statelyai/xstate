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
}

interface IMachine extends IState {
  id: string;
  transition: (stateId: string | StatePath, action: Action) => IState;
  getState: (stateId: string | StatePath) => IState;
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

function getState(machine: IMachine | IMachineConfig, stateId: string | StatePath): IState {
  const statePath = toStatePath(stateId);
  const stateString: string = Array.isArray(stateId) ? stateId.join(STATE_DELIMITER) : stateId;
  let currentState: IStateConfig = machine;

  for (let subState of statePath) {
    currentState = currentState.states[subState];
    if (!currentState) throw new Error(`State '${stateId}' does not exist on machine.`);
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

export default function xstate(machine: IMachineConfig): IMachine {
  let eventsCache;

  return {
    ...machine,
    transition: (stateId, action) => {
      const state = getState(machine, stateId);

      if (state.final || !state.on) return state;

      const nextStateId = state.on[getActionType(action)];

      if (!nextStateId) throw new Error(`State '${state}' has no transition from action '${getActionType(action)}'`);

      return getState(machine, nextStateId);
    },
    getState: (stateId) => getState(machine, stateId),
    getEvents: () => eventsCache || (eventsCache = getEvents(machine)),
    get events() {
      return this.getEvents();
    }
  }
}
