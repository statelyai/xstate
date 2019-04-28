"use strict";
exports.__esModule = true;
function toArray(item) {
    return [].concat(item);
}
function FSM(fsmConfig) {
    return {
        initialState: {
            value: fsmConfig.initial,
            actions: toArray(fsmConfig.states[fsmConfig.initial].entry),
            context: fsmConfig.context
        },
        transition: function (state, event) {
            var _a = typeof state === 'string'
                ? { value: state, context: fsmConfig.context }
                : state, value = _a.value, context = _a.context;
            var eventObject = typeof event === 'string' ? { type: event } : event;
            var stateConfig = fsmConfig.states[value];
            if (stateConfig.on) {
                var transitions = [].concat(stateConfig.on[eventObject.type]);
                for (var _i = 0, transitions_1 = transitions; _i < transitions_1.length; _i++) {
                    var transition = transitions_1[_i];
                    if (transition === undefined) {
                        return { value: value, context: context, actions: [] };
                    }
                    var _b = typeof transition === 'string'
                        ? { target: transition }
                        : transition, target = _b.target, _c = _b.actions, actions = _c === void 0 ? [] : _c, _d = _b.cond, cond = _d === void 0 ? function () { return true; } : _d;
                    if (target && cond(context)) {
                        var nextStateConfig = fsmConfig.states[target];
                        var allActions = []
                            .concat(stateConfig.exit)
                            .concat(actions)
                            .concat(nextStateConfig.entry)
                            .filter(Boolean);
                        return {
                            value: target ? target : value,
                            context: context,
                            actions: allActions
                        };
                    }
                }
                return {
                    value: value,
                    context: context,
                    actions: []
                };
            }
            return { value: value, context: context, actions: [] };
        }
    };
}
exports.FSM = FSM;
