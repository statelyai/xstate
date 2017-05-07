var xstate = (function () {
'use strict';

var __assign = (window && window.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var STATE_DELIMITER = '.';
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
        throw new Error("'" + stateId + "' is not a valid state path.");
    }
}
function getState(machine, stateId) {
    var statePath = toStatePath(stateId);
    var stateString = Array.isArray(stateId) ? stateId.join(STATE_DELIMITER) : stateId;
    var currentState = machine;
    for (var _i = 0, statePath_1 = statePath; _i < statePath_1.length; _i++) {
        var subState = statePath_1[_i];
        currentState = currentState.states[subState];
        if (!currentState)
            throw new Error("State '" + stateId + "' does not exist on machine.");
    }
    return __assign({}, currentState, { id: stateString, toString: function () { return stateString; } });
}
function getEvents(machine) {
    var eventsMap = {};
    Object.keys(machine.states).forEach(function (stateId) {
        var state = machine.states[stateId];
        if (state.states) {
            for (var _i = 0, _a = getEvents(state); _i < _a.length; _i++) {
                var event = _a[_i];
                if (eventsMap[event])
                    continue;
                eventsMap[event] = true;
            }
        }
        if (!state.on)
            return;
        for (var _b = 0, _c = Object.keys(state.on); _b < _c.length; _b++) {
            var event = _c[_b];
            if (eventsMap[event])
                continue;
            eventsMap[event] = true;
        }
    });
    return Object.keys(eventsMap);
}
function xstate(machine) {
    var eventsCache;
    return __assign({}, machine, { transition: function (stateId, action) {
            var state = getState(machine, stateId);
            if (state.final || !state.on)
                return state;
            var nextStateId = state.on[getActionType(action)];
            if (!nextStateId)
                throw new Error("State '" + state + "' has no transition from action '" + getActionType(action) + "'");
            return getState(machine, nextStateId);
        }, getState: function (stateId) { return getState(machine, stateId); }, getEvents: function () { return eventsCache || (eventsCache = getEvents(machine)); }, get events() {
            return this.getEvents();
        } });
}

return xstate;

}());
