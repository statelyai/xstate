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
function getState(machine, stateId) {
    var state = machine.states[stateId];
    if (!state)
        throw new Error("State '" + stateId + "' does not exist on machine.");
    return __assign({}, state, { id: stateId, toString: function () { return stateId; } });
}
function xstate(machine) {
    var eventsMap = {}, eventsCache;
    return __assign({}, machine, { transition: function (stateId, action) {
            var state = getState(machine, stateId);
            if (state.final || !state.on)
                return state;
            var nextStateId = state.on[getActionType(action)];
            if (!nextStateId)
                throw new Error("State '" + state + "' has no transition from action '" + getActionType(action) + "'");
            return getState(machine, nextStateId);
        }, getState: function (stateId) { return getState(machine, stateId); }, getEvents: function () {
            if (eventsCache)
                return eventsCache;
            Object.keys(machine.states).forEach(function (stateId) {
                var state = machine.states[stateId];
                if (!state.on)
                    return;
                Object.keys(state.on).forEach(function (actionKey) {
                    if (eventsCache[actionKey]) {
                        eventsMap[actionKey].push(stateId);
                    }
                    else {
                        eventsMap[actionKey] = [stateId];
                        eventsCache.push(stateId);
                    }
                });
            });
            return eventsCache;
        }, get events() {
            return this.getEvents();
        } });
}

return xstate;

}());
