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
  BaseActionObject
} from './types.ts';
import * as actionTypes from './actionTypes.ts';
import { isArray } from './utils.ts';
import {
  createDynamicAction,
  isDynamicAction
} from '../actions/dynamicAction.ts';
export {
  send,
  sendTo,
  sendParent,
  forwardTo,
  escalate
} from './actions/send.ts';

export { stop } from './actions/stop.ts';
export { log } from './actions/log.ts';
export { cancel } from './actions/cancel.ts';
export { assign } from './actions/assign.ts';
export { raise } from './actions/raise.ts';
export { choose } from './actions/choose.ts';
export { pure } from './actions/pure.ts';
export { actionTypes };

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
      { type: 'xstate.function', params: actionObject.params ?? {} },
      (event, { state }) => {
        const a: BaseActionObject = {
          type: actionObject.type,
          params: actionObject.params,
          execute: (actorCtx) => {
            return dereferencedAction({
              context: state.context,
              event,
              action: a,
              system: actorCtx.system,
              self: actorCtx.self
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
    return createDynamicAction({ type, params: {} }, (event, { state }) => {
      const actionObject: BaseActionObject = {
        type,
        params: {
          function: action
        },
        execute: (actorCtx) => {
          return action({
            context: state.context as TContext,
            event: event as TEvent,
            action: actionObject,
            self: actorCtx.self,
            system: actorCtx.system
          });
        }
      };

      return [state, actionObject];
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
 * @param output The data to pass into the event
 */
export function done(id: string, output?: any): DoneEventObject {
  const type = `${ActionTypes.DoneState}.${id}`;
  const eventObject = {
    type,
    output
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
 * @param output The data to pass into the event
 */
export function doneInvoke(invokeId: string, output?: any): DoneEvent {
  const type = `${ActionTypes.DoneInvoke}.${invokeId}`;
  const eventObject = {
    type,
    output
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

export function createInitEvent(input: any) {
  return { type: actionTypes.init, input } as const;
}
