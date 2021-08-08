import {
  Action,
  Event,
  EventObject,
  SingleOrArray,
  ActionType,
  ActionFunction,
  ActionFunctionMap,
  ActionTypes,
  SpecialTargets,
  DoneEvent,
  ErrorPlatformEvent,
  DoneEventObject,
  ChooseCondition,
  MachineContext
} from './types';
import * as actionTypes from './actionTypes';
import { isFunction, isString, toSCXMLEvent, isArray } from './utils';
import { ExecutableAction } from '../actions/ExecutableAction';
import { send } from './actions/send';
import { BaseActionObject, DAction } from '.';
import { DynamicAction } from '../actions/DynamicAction';
import { evaluateGuard, toGuardDefinition } from './guards';
export {
  send,
  sendUpdate,
  sendParent,
  respond,
  forwardTo,
  escalate
} from './actions/send';
export { stop } from './actions/stop';
export { log } from './actions/log';
export { cancel } from './actions/cancel';
export { actionTypes };

export const initEvent = toSCXMLEvent({ type: actionTypes.init });

export function getActionFunction<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  actionType: ActionType,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): BaseActionObject | ActionFunction<TContext, TEvent> | undefined {
  return actionFunctionMap
    ? actionFunctionMap[actionType] || undefined
    : undefined;
}

export function resolveActionObject(
  actionObject: BaseActionObject,
  actionFunctionMap: ActionFunctionMap<any, any>
): BaseActionObject {
  const exec = getActionFunction(actionObject.type, actionFunctionMap);
  if (isFunction(exec)) {
    return new ExecutableAction(actionObject, exec);
  } else if (exec) {
    return exec;
  } else {
    return actionObject;
  }
}

export function toActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  action: BaseActionObject | ActionFunction<TContext, TEvent> | string,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): BaseActionObject {
  if (action instanceof DynamicAction) {
    return action;
  }

  if (isString(action) || typeof action === 'number') {
    const exec = getActionFunction(action, actionFunctionMap);
    if (isFunction(exec)) {
      return new ExecutableAction({ type: action, params: {} }, exec);
    } else if (exec) {
      return exec;
    } else {
      return new ExecutableAction({ type: action, params: {} });
    }
  } else if (isFunction(action)) {
    return new ExecutableAction(
      {
        type: action.name ?? 'xstate:expr',
        params: {}
      },
      action
    );
  } else {
    // action is action object
    return action;
  }
}

export const toActionObjects = <
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  action?: SingleOrArray<Action<TContext, TEvent>> | undefined,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): BaseActionObject[] => {
  if (!action) {
    return [];
  }

  const actions = isArray(action) ? action : [action];

  return actions.map((subAction) =>
    toActionObject(subAction, actionFunctionMap)
  );
};

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */
export function raise<
  TContext extends MachineContext,
  TEvent extends EventObject
>(event: Event<TEvent>) {
  if (!isString(event)) {
    return send(event, { to: SpecialTargets.Internal });
  }

  return {
    type: actionTypes.raise,
    params: {
      event,
      _event: toSCXMLEvent(event)
    }
  };
}

export function isActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
>(action: Action<TContext, TEvent>): action is BaseActionObject {
  return typeof action === 'object' && 'type' in action;
}

/**
 * Returns an event type that represents an implicit event that
 * is sent after the specified `delay`.
 *
 * @param delayRef The delay in milliseconds
 * @param id The state node ID where this event is handled
 */
export function after(delayRef: number | string, id?: string) {
  const idSuffix = id ? `#${id}` : '';
  return `${ActionTypes.After}(${delayRef})${idSuffix}`;
}

/**
 * Returns an event that represents that a final state node
 * has been reached in the parent state node.
 *
 * @param id The final state node's parent state node `id`
 * @param data The data to pass into the event
 */
export function done(id: string, data?: any): DoneEventObject {
  const type = `${ActionTypes.DoneState}.${id}`;
  const eventObject = {
    type,
    data
  };

  eventObject.toString = () => type;

  return eventObject as DoneEvent;
}

/**
 * Returns an event that represents that an invoked service has terminated.
 *
 * An invoked service is terminated when it has reached a top-level final state node,
 * but not when it is canceled.
 *
 * @param invokeId The invoked service ID
 * @param data The data to pass into the event
 */
export function doneInvoke(invokeId: string, data?: any): DoneEvent {
  const type = `${ActionTypes.DoneInvoke}.${invokeId}`;
  const eventObject = {
    type,
    data
  };

  eventObject.toString = () => type;

  return eventObject as DoneEvent;
}

export function error(id: string, data?: any): ErrorPlatformEvent & string {
  const type = `${ActionTypes.ErrorPlatform}.${id}`;
  const eventObject = { type, data };

  eventObject.toString = () => type;

  return eventObject as ErrorPlatformEvent & string;
}

export function choose<
  TContext extends MachineContext,
  TEvent extends EventObject
>(guards: Array<ChooseCondition<TContext, TEvent>>): DAction<TContext, TEvent> {
  return new DynamicAction<
    TContext,
    TEvent,
    {
      type: ActionTypes.Choose;
      params: {
        actions: BaseActionObject[];
      };
    }
  >(
    actionTypes.choose,
    {
      guards
    },
    (action, context, _event, { machine, state }) => {
      const matchedActions = action.params.guards.find((condition) => {
        const guard =
          condition.guard &&
          toGuardDefinition(
            condition.guard,
            (guardType) => machine.options.guards[guardType]
          );
        return !guard || evaluateGuard(guard, context, _event, state);
      })?.actions;

      return {
        type: actionTypes.choose,
        params: {
          actions: matchedActions
        }
      };
    }
  );
}
