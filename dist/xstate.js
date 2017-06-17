(function (exports) {
'use strict';

const STATE_DELIMITER = '.';
function getActionType(action) {
    try {
        return typeof action === 'string'
            ? action
            : action.type;
    }
    catch (e) {
        throw new Error('Actions must be strings or objects with a string action.type.');
    }
}
function toStatePath(stateId) {
    try {
        if (Array.isArray(stateId))
            return stateId;
        return stateId.split(STATE_DELIMITER);
    }
    catch (e) {
        throw new Error(`'${stateId}' is not a valid state path.`);
    }
}
function getState(machine, stateId) {
    const statePath = stateId
        ? toStatePath(Array.isArray(stateId) ? stateId : stateId + '')
        : toStatePath(machine.initial);
    const stateString = statePath.join(STATE_DELIMITER);
    let currentState = machine;
    for (let subState of statePath) {
        currentState = currentState.states[subState];
        if (!currentState)
            throw new Error(`State '${stateId}' does not exist on machine ${machine.id}`);
    }
    currentState.id = stateString;
    return new State(currentState);
}
function getEvents(machine) {
    const eventsMap = {};
    Object.keys(machine.states).forEach(stateId => {
        const state = machine.states[stateId];
        if (state.states) {
            for (let event of getEvents(state)) {
                if (eventsMap[event])
                    continue;
                eventsMap[event] = true;
            }
        }
        if (!state.on)
            return;
        for (let event of Object.keys(state.on)) {
            if (eventsMap[event])
                continue;
            eventsMap[event] = true;
        }
    });
    return Object.keys(eventsMap);
}
function getNextState(machine, stateId, action) {
    const statePath = stateId
        ? toStatePath(Array.isArray(stateId) ? stateId : stateId.toString())
        : toStatePath(machine.initial);
    const stack = [];
    let currentState = machine;
    let nextStateId;
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
function matchesState(parentStateId, childStateId) {
    const parentStatePath = toStatePath(parentStateId);
    const childStatePath = toStatePath(childStateId);
    if (parentStatePath.length > childStatePath.length)
        return false;
    for (let i in parentStatePath) {
        if (parentStatePath[i] !== childStatePath[i])
            return false;
    }
    return true;
}
class State {
    constructor(config) {
        this.id = config.id;
        this.initial = config.initial;
        this.states = config.states;
        this.on = config.on;
    }
    transition(stateId, action) {
        return getNextState(this, stateId, action);
    }
    getState(stateId) {
        return getState(this, stateId);
    }
    get events() {
        return getEvents(this);
    }
    toString() {
        return this.id;
    }
}
class Machine extends State {
}

exports.matchesState = matchesState;
exports.State = State;
exports.Machine = Machine;

}((this.xstate = this.xstate || {})));
