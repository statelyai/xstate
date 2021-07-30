import {
  Action,
  Event,
  EventObject,
  SingleOrArray,
  SendAction,
  SendActionOptions,
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
  SendExpr,
  PureAction,
  ExprWithMeta,
  ChooseConditon,
  ChooseAction,
  AnyEventObject,
  MachineContext
} from './types';
import * as actionTypes from './actionTypes';
import { isFunction, isString, toSCXMLEvent, isArray } from './utils';
import { ResolvedAction } from '../actions/resolvedAction';
import { RaiseActionObject } from '.';
import { send } from './actions/send';
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
): ActionObject<TContext, TEvent> {
  let actionObject: ActionObject<TContext, TEvent>;

  if (isString(action) || typeof action === 'number') {
    const exec = getActionFunction(action, actionFunctionMap);
    if (isFunction(exec)) {
      actionObject = {
        type: action,
        exec
      };
    } else if (exec) {
      actionObject = exec;
    } else {
      actionObject = { type: action, exec: undefined };
    }
  } else if (isFunction(action)) {
    actionObject = new ResolvedAction(
      {
        type: action.name ?? 'xstate:expr'
      },
      action
    );
  } else {
    const exec = getActionFunction(action.type, actionFunctionMap);
    if (isFunction(exec)) {
      actionObject = {
        ...action,
        exec
      };
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
 * Sends an event to this machine's parent.
 *
 * @param event The event to send to the parent machine.
 * @param options Options to pass into the send event.
 */
export function sendParent<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
>(
  event: Event<TSentEvent> | SendExpr<TContext, TEvent, TSentEvent>,
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent, TSentEvent>(event, {
    ...options,
    to: SpecialTargets.Parent
  });
}

/**
 * Sends an update event to this machine's parent.
 */
export function sendUpdate<
  TContext extends MachineContext,
  TEvent extends EventObject
>() {
  return sendParent<TContext, TEvent, { type: ActionTypes.Update }>(
    actionTypes.update
  );
}

/**
 * Sends an event back to the sender of the original event.
 *
 * @param event The event to send back to the sender
 * @param options Options to pass into the send event
 */
export function respond<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TSentEvent extends EventObject = AnyEventObject
>(
  event: Event<TEvent> | SendExpr<TContext, TEvent, TSentEvent>,
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent>(event, {
    ...options,
    to: (_, __, { _event }) => {
      return _event.origin!; // TODO: handle when _event.origin is undefined
    }
  });
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

/**
 * Forwards (sends) an event to a specified service.
 *
 * @param target The target service to forward the event to.
 * @param options Options to pass into the send action creator.
 */
export function forwardTo<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  target: Required<SendActionOptions<TContext, TEvent>>['to'],
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent>((_, event) => event, {
    ...options,
    to: target
  });
}

/**
 * Escalates an error by sending it as an event to this machine's parent.
 *
 * @param errorData The error data to send, or the expression function that
 * takes in the `context`, `event`, and `meta`, and returns the error data to send.
 * @param options Options to pass into the send action creator.
 */
export function escalate<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TErrorData = any
>(
  errorData: TErrorData | ExprWithMeta<TContext, TEvent, TErrorData>,
  options?: SendActionOptions<TContext, TEvent>
) {
  return sendParent<TContext, TEvent>(
    (context, event, meta) => {
      return {
        type: actionTypes.error,
        data: isFunction(errorData)
          ? errorData(context, event, meta)
          : errorData
      };
    },
    {
      ...options,
      to: SpecialTargets.Parent
    }
  );
}

export function choose<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  guards: Array<ChooseConditon<TContext, TEvent>>
): ChooseAction<TContext, TEvent> {
  return {
    type: ActionTypes.Choose,
    guards
  };
}
