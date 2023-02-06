import {
  Action,
  EventObject,
  SingleOrArray,
  ActionFunction,
  ActionFunctionMap,
  ActionTypes,
  DoneEvent,
  ErrorPlatformEvent,
  DoneEventObject,
  MachineContext,
  BaseActionObject,
  SCXML,
  AnyState
} from './types.js';
import * as actionTypes from './actionTypes.js';
import { toSCXMLEvent, isArray } from './utils.js';
import {
  createDynamicAction,
  isDynamicAction
} from '../actions/dynamicAction.js';
export {
  send,
  sendTo,
  sendParent,
  respond,
  forwardTo,
  escalate
} from './actions/send.js';

export { stop } from './actions/stop.js';
export { log } from './actions/log.js';
export { cancel } from './actions/cancel.js';
export { assign } from './actions/assign.js';
export { raise } from './actions/raise.js';
export { choose } from './actions/choose.js';
export { actionTypes };

export const initEvent = toSCXMLEvent({ type: actionTypes.init });

export function resolveActionObject(
  actionObject: BaseActionObject,
  actionFunctionMap: ActionFunctionMap<any, any>
): BaseActionObject {
  if (isDynamicAction(actionObject)) {
    return actionObject;
  }
  const dereferencedAction = actionFunctionMap[actionObject.type];

  if (typeof dereferencedAction === 'function') {
    return createDynamicAction(
      { type: 'xstate.expr', params: actionObject.params ?? {} },
      (_event, { state }) => {
        const a: BaseActionObject = {
          type: actionObject.type,
          params: actionObject.params,
          execute: (_actorCtx) => {
            return dereferencedAction(state.context, state.event, {
              action: a,
              _event: state._event,
              state
            });
          }
        };

        return [state, a];
      }
    );
  } else if (dereferencedAction) {
    return dereferencedAction;
  } else {
    return actionObject;
  }
}

export function toActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  action: BaseActionObject | ActionFunction<TContext, TEvent> | string
): BaseActionObject {
  if (isDynamicAction(action)) {
    return action;
  }

  if (typeof action === 'string') {
    return { type: action, params: {} };
  }

  if (typeof action === 'function') {
    const type = 'xstate.function';
    return createDynamicAction({ type, params: {} }, (_event, { state }) => {
      const a: BaseActionObject = {
        type,
        params: {
          function: action
        },
        execute: (_actorCtx) => {
          return action(state.context as TContext, _event.data as TEvent, {
            action: a,
            _event: _event as SCXML.Event<TEvent>,
            state: state as AnyState
          });
        }
      };

      return [state, a];
    });
  }

  // action is already a BaseActionObject
  return action;
}

export const toActionObjects = <
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  action?: SingleOrArray<Action<TContext, TEvent>>
): BaseActionObject[] => {
  if (!action) {
    return [];
  }
  const actions = isArray(action) ? action : [action];
  return actions.map(toActionObject);
};

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

export function createInitEvent(
  input: any
): SCXML.Event<{ type: ActionTypes.Init; input: any }> {
  return toSCXMLEvent({ type: actionTypes.init, input });
}
