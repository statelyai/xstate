import {
  Action,
  Event,
  EventObject,
  SingleOrArray,
  ActionObject,
  ActionType,
  Assigner,
  PropertyAssigner,
  AssignAction,
  ActionFunction,
  ActionFunctionMap,
  ActionTypes,
  SpecialTargets,
  DoneEvent,
  ErrorPlatformEvent,
  DoneEventObject,
  PureAction,
  ChooseConditon,
  ChooseAction,
  MachineContext
} from './types';
import * as actionTypes from './actionTypes';
import { isFunction, isString, toSCXMLEvent, isArray } from './utils';
import { ExecutableAction } from '../actions/ExecutableAction';
import { send } from './actions/send';
import { BaseActionObject } from '.';
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
):
  | ActionObject<TContext, TEvent>
  | ActionFunction<TContext, TEvent>
  | undefined {
  return actionFunctionMap
    ? actionFunctionMap[actionType] || undefined
    : undefined;
}

export function toActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  action: Action<TContext, TEvent>,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): BaseActionObject {
  let actionObject: BaseActionObject;

  if (isString(action) || typeof action === 'number') {
    const exec = getActionFunction(action, actionFunctionMap);
    if (isFunction(exec)) {
      actionObject = new ExecutableAction({ type: action }, exec);
    } else if (exec) {
      actionObject = exec;
    } else {
      actionObject = new ExecutableAction({ type: action });
    }
  } else if (isFunction(action)) {
    actionObject = new ExecutableAction(
      {
        type: action.name ?? 'xstate:expr'
      },
      action
    );
  } else {
    const exec = getActionFunction(action.type, actionFunctionMap);
    if (isFunction(exec)) {
      actionObject = new ExecutableAction(action, exec);
    } else if (exec) {
      const actionType = exec.type || action.type;

      actionObject = {
        ...exec,
        ...action,
        type: actionType
      } as ActionObject<TContext, TEvent>;
    } else {
      actionObject = action as ActionObject<TContext, TEvent>;
    }
  }

  Object.defineProperty(actionObject, 'toString', {
    value: () => actionObject.type,
    enumerable: false,
    configurable: true
  });

  return actionObject;
}

export const toActionObjects = <
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  action?: SingleOrArray<Action<TContext, TEvent>> | undefined,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): Array<ActionObject<TContext, TEvent>> => {
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

/**
 * Updates the current context of the machine.
 *
 * @param assignment An object that represents the partial context to update.
 */
export const assign = <
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject
>(
  assignment: Assigner<TContext, TEvent> | PropertyAssigner<TContext, TEvent>
): AssignAction<TContext, TEvent> => {
  return {
    type: actionTypes.assign,
    assignment
  };
};

export function isActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
>(action: Action<TContext, TEvent>): action is ActionObject<TContext, TEvent> {
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

export function pure<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  getActions: (
    context: TContext,
    event: TEvent
  ) => SingleOrArray<ActionObject<TContext, TEvent>> | undefined
): PureAction<TContext, TEvent> {
  return {
    type: ActionTypes.Pure,
    get: getActions
  };
}

export function choose<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  guards: Array<ChooseConditon<TContext, TEvent>>
): ChooseAction<TContext, TEvent> {
  return {
    type: ActionTypes.Choose,
    params: { guards }
  };
}
