(function (exports) {
'use strict';

function getActionType(action) {
    try {
        return typeof action === 'string' || typeof action === 'number'
            ? `${action}`
            : action.type;
    }
    catch (e) {
        throw new Error('Actions must be strings or objects with a string action.type.');
    }
}
function toStatePath(stateId) {
    try {
        if (Array.isArray(stateId)) {
            return stateId;
        }
        return stateId.toString().split('.');
    }
    catch (e) {
        throw new Error(`'${stateId}' is not a valid state path.`);
    }
}
function toTrie(stateValue) {
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
        }
        else {
            marker[statePath[i]] = {};
            marker = marker[statePath[i]];
        }
    }
    return value;
}
function mapValues(collection, iteratee) {
    const result = {};
    Object.keys(collection).forEach(key => {
        result[key] = iteratee(collection[key], key, collection);
    });
    return result;
}

function matchesState(parentStateId, childStateId) {
    const parentStateValue = toTrie(parentStateId);
    const childStateValue = toTrie(childStateId);
    if (typeof childStateValue === 'string') {
        if (typeof parentStateValue === 'string') {
            return childStateValue === parentStateValue;
        }
        return childStateValue in parentStateValue;
    }
    if (typeof parentStateValue === 'string') {
        return parentStateValue in childStateValue;
    }
    return Object.keys(parentStateValue).every(key => {
        if (!(key in childStateValue)) {
            return false;
        }
        return matchesState(parentStateValue[key], childStateValue[key]);
    });
}

function mapState(stateMap, stateId) {
    let foundStateId;
    Object.keys(stateMap).forEach(mappedStateId => {
        if (matchesState(mappedStateId, stateId) &&
            (!foundStateId || stateId.length > foundStateId.length)) {
            foundStateId = mappedStateId;
        }
    });
    return stateMap[foundStateId];
}

const STATE_DELIMITER$1 = '.';

class State {
    constructor({ value, history, changed }) {
        this.value = value;
        this.history = history;
        this.changed = changed;
    }
    toString() {
        if (typeof this.value === 'string') {
            return this.value;
        }
        const path = [];
        let marker = this.value;
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
        return path.join(STATE_DELIMITER$1);
    }
}

function createHistory(config) {
    if (!config.states) {
        return undefined;
    }
    const history = mapValues(config.states, (state, stateId) => {
        if (!state.states) {
            return;
        }
        return createHistory(state);
    });
    history.$current = config.initial;
    return history;
}
function updateHistory(history, stateValue) {
    const nextHistory = Object.assign({}, history, { $current: stateValue });
    if (typeof stateValue === 'string') {
        return nextHistory;
    }
    Object.keys(stateValue).forEach(subStatePath => {
        const subHistory = history[subStatePath];
        const subStateValue = stateValue[subStatePath];
        if (typeof subHistory === 'string') {
            // this will never happen, just making TS happy
            return;
        }
        nextHistory[subStatePath] = updateHistory(subHistory, subStateValue);
    });
    return nextHistory;
}

const STATE_DELIMITER = '.';
function getNextStateValue(parent, stateValue, action, history = parent.history) {
    if (typeof stateValue === 'string') {
        const state = parent.states[stateValue];
        const initialState = state.getInitialState();
        if (initialState) {
            stateValue = {
                [stateValue]: initialState
            };
        }
        else {
            return state.next(action, history) || undefined;
        }
    }
    if (parent.parallel) {
        const initialState = parent.getInitialState();
        if (typeof initialState !== 'string') {
            stateValue = Object.assign({}, initialState, stateValue);
        }
    }
    if (Object.keys(stateValue).length === 1) {
        const subStateKey = Object.keys(stateValue)[0];
        const subState = parent.states[subStateKey];
        const subStateValue = stateValue[subStateKey];
        const subHistory = history[subStateKey];
        const nextValue = getNextStateValue(subState, subStateValue, action, subHistory);
        if (nextValue) {
            return { [subStateKey]: nextValue };
        }
        return subState.next(action, history);
    }
    const nextValue = {};
    let willTransition = false;
    const untransitionedKeys = {};
    Object.keys(stateValue).forEach(key => {
        const subValue = getNextStateValue(parent.states[key], stateValue[key], action, history[key]);
        if (subValue) {
            nextValue[key] = subValue;
            willTransition = true;
        }
        else {
            nextValue[key] = undefined;
            untransitionedKeys[key] = stateValue[key];
        }
    });
    return willTransition
        ? Object.assign(nextValue, untransitionedKeys)
        : undefined;
}
class StateNode {
    constructor(config, history) {
        this._relativeValue = new Map();
        this.key = config.key;
        this.parent = config.parent;
        this.id = this.parent
            ? this.parent.id + STATE_DELIMITER + this.key
            : this.key;
        this.initial = config.initial;
        this.parallel = !!config.parallel;
        this.history = history || createHistory(config);
        this.states = config.states
            ? mapValues(config.states, (stateConfig, key) => new StateNode(Object.assign({}, stateConfig, { key, parent: this }), history))
            : {};
        this.on = config.on;
    }
    transition(state, action) {
        let stateValue = (state instanceof State ? state.value : state) || this.getInitialState();
        const history = state instanceof State ? state.history : this.history;
        stateValue = toTrie(stateValue);
        const nextValue = getNextStateValue(this, stateValue, action, history) ||
            getNextStateValue(this, stateValue, undefined, history);
        return new State({
            value: nextValue,
            history: updateHistory(history, stateValue),
            changed: true
        });
    }
    next(action, history) {
        if (!action) {
            return this.key;
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
            currentHistory = currentHistory[subPath];
        });
        while (currentState.initial) {
            currentState = currentState.states[currentState.initial];
        }
        return currentState.getRelativeValue(this.parent);
    }
    getInitialState() {
        let initialState = this._initialState;
        if (initialState) {
            return initialState;
        }
        initialState = this.parallel
            ? mapValues(this.states, state => state.getInitialState())
            : this.initial;
        return (this._initialState = initialState);
    }
    getState(relativeStateId) {
        const statePath = toStatePath(relativeStateId);
        try {
            return statePath.reduce((subState, subPath) => {
                return subState.states[subPath];
            }, this);
        }
        catch (e) {
            return undefined;
        }
    }
    get events() {
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
    getRelativeValue(toNode) {
        const memoizedRelativeValue = this._relativeValue.get(toNode);
        if (memoizedRelativeValue) {
            return memoizedRelativeValue;
        }
        const initialState = this.getInitialState();
        let relativeValue = initialState
            ? {
                [this.key]: initialState
            }
            : this.key;
        let currentNode = this.parent;
        while (currentNode && currentNode !== toNode) {
            const currentInitialState = currentNode.getInitialState();
            relativeValue = {
                [currentNode.key]: typeof currentInitialState === 'object' &&
                    typeof relativeValue === 'object'
                    ? Object.assign({}, currentInitialState, relativeValue) : relativeValue
            };
            currentNode = currentNode.parent;
        }
        this._relativeValue.set(toNode, relativeValue);
        return relativeValue;
    }
}
function Machine(config) {
    return new StateNode(config);
}

exports.StateNode = StateNode;
exports.Machine = Machine;
exports.State = State;
exports.matchesState = matchesState;
exports.mapState = mapState;

}((this.xstate = this.xstate || {})));
