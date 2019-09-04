import {
  Action,
  Event,
  EventObject,
  SingleOrArray,
  SendAction,
  SendActionOptions,
  CancelAction,
  ActionObject,
  ActionType,
  Assigner,
  PropertyAssigner,
  AssignAction,
  ActionFunction,
  ActionFunctionMap,
  ActivityActionObject,
  ActionTypes,
  ActivityDefinition,
  SpecialTargets,
  RaiseAction,
  RaiseActionObject,
  DoneEvent,
  ErrorPlatformEvent,
  DoneEventObject,
  SendExpr,
  SendActionObject,
  PureAction,
  LogExpr,
  LogAction,
  LogActionObject,
  DelayFunctionMap,
  SCXML
} from './types';
import * as actionTypes from './actionTypes';
import {
  getEventType,
  isFunction,
  isString,
  toEventObject,
  toSCXMLEvent
} from './utils';
import { isArray } from './utils';

export { actionTypes };

export const initEvent = toSCXMLEvent({ type: actionTypes.init });

export function getActionFunction<TContext, TEvent extends EventObject>(
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

export function toActionObject<TContext, TEvent extends EventObject>(
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
    actionObject = {
      // Convert action to string if unnamed
      type: action.name || action.toString(),
      exec: action
    };
  } else {
    const exec = getActionFunction(action.type, actionFunctionMap);
    if (isFunction(exec)) {
      actionObject = {
        ...action,
        exec
      };
    } else if (exec) {
      const { type, ...other } = action;

      actionObject = {
        type,
        ...exec,
        ...other
      };
    } else {
      actionObject = action;
    }
  }

  Object.defineProperty(actionObject, 'toString', {
    value: () => actionObject.type,
    enumerable: false,
    configurable: true
  });

  return actionObject;
}

export const toActionObjects = <TContext, TEvent extends EventObject>(
  action?: SingleOrArray<Action<TContext, TEvent>> | undefined,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): Array<ActionObject<TContext, TEvent>> => {
  if (!action) {
    return [];
  }

  const actions = isArray(action) ? action : [action];

  return actions.map(subAction => toActionObject(subAction, actionFunctionMap));
};

export function toActivityDefinition<TContext, TEvent extends EventObject>(
  action: string | ActivityDefinition<TContext, TEvent>
): ActivityDefinition<TContext, TEvent> {
  const actionObject = toActionObject(action);

  return {
    id: isString(action) ? action : actionObject.id,
    ...actionObject,
    type: actionObject.type
  };
}

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */
export function raise<TContext, TEvent extends EventObject>(
  event: Event<TEvent>
): RaiseAction<TEvent> | SendAction<TContext, TEvent> {
  if (!isString(event)) {
    return send(event, { to: SpecialTargets.Internal });
  }
  return {
    type: actionTypes.raise,
    event
  };
}

export function resolveRaise<TEvent extends EventObject>(
  action: RaiseAction<TEvent>
): RaiseActionObject<TEvent> {
  return {
    type: actionTypes.raise,
    _event: toSCXMLEvent(action.event)
  };
}

/**
 * Sends an event. This returns an action that will be read by an interpreter to
 * send the event in the next step, after the current step is finished executing.
 *
 * @param event The event to send.
 * @param options Options to pass into the send event:
 *  - `id` - The unique send event identifier (used with `cancel()`).
 *  - `delay` - The number of milliseconds to delay the sending of the event.
 *  - `target` - The target of this event (by default, the machine the event was sent from).
 */
export function send<TContext, TEvent extends EventObject>(
  event: Event<TEvent> | SendExpr<TContext, TEvent>,
  options?: SendActionOptions<TContext, TEvent>
): SendAction<TContext, TEvent> {
  return {
    to: options ? options.to : undefined,
    type: actionTypes.send,
    event: isFunction(event) ? event : toEventObject<TEvent>(event),
    delay: options ? options.delay : undefined,
    id:
      options && options.id !== undefined
        ? options.id
        : isFunction(event)
        ? event.name
        : (getEventType<TEvent>(event) as string)
  };
}

export function resolveSend<TContext, TEvent extends EventObject>(
  action: SendAction<TContext, TEvent>,
  ctx: TContext,
  _event: SCXML.Event<TEvent>,
  delaysMap?: DelayFunctionMap<TContext, TEvent>
): SendActionObject<TContext, TEvent> {
  const meta = {
    _event
  };

  // TODO: helper function for resolving Expr
  const resolvedEvent = toSCXMLEvent(
    isFunction(action.event)
      ? action.event(ctx, _event.data, meta)
      : action.event
  );

  let resolvedDelay: number | undefined;
  if (isString(action.delay)) {
    const configDelay = delaysMap && delaysMap[action.delay];
    resolvedDelay = isFunction(configDelay)
      ? configDelay(ctx, _event.data, meta)
      : configDelay;
  } else {
    resolvedDelay = isFunction(action.delay)
      ? action.delay(ctx, _event.data, meta)
      : action.delay;
  }

  const resolvedTarget = isFunction(action.to)
    ? action.to(ctx, _event.data, meta)
    : action.to;

  return {
    ...action,
    to: resolvedTarget,
    _event: resolvedEvent,
    event: resolvedEvent.data,
    delay: resolvedDelay
  };
}

/**
 * Sends an event to this machine's parent.
 *
 * @param event The event to send to the parent machine.
 * @param options Options to pass into the send event.
 */
export function sendParent<TContext, TEvent extends EventObject>(
  event: Event<TEvent> | SendExpr<TContext, TEvent>,
  options?: SendActionOptions<TContext, TEvent>
): SendAction<TContext, TEvent> {
  return send<TContext, TEvent>(event, {
    ...options,
    to: SpecialTargets.Parent
  });
}

/**
 * Sends an update event to this machine's parent.
 */
export function sendUpdate<TContext, TEvent extends EventObject>(): SendAction<
  TContext,
  TEvent
> {
  return sendParent<TContext, TEvent>(actionTypes.update);
}

/**
 * Sends an event back to the sender of the original event.
 *
 * @param event The event to send back to the sender
 * @param options Options to pass into the send event
 */
export function respond<TContext, TEvent extends EventObject>(
  event: Event<TEvent> | SendExpr<TContext, TEvent>,
  options?: SendActionOptions<TContext, TEvent>
) {
  return send<TContext, TEvent>(event, {
    ...options,
    to: (_, __, { _event }) => {
      return _event.origin!; // TODO: handle when _event.origin is undefined
    }
  });
}

const defaultLogExpr = <TContext, TEvent extends EventObject>(
  context: TContext,
  event: TEvent
) => ({
  context,
  event
});

/**
 *
 * @param expr The expression function to evaluate which will be logged.
 *  Takes in 2 arguments:
 *  - `ctx` - the current state context
 *  - `event` - the event that caused this action to be executed.
 * @param label The label to give to the logged expression.
 */
export function log<TContext, TEvent extends EventObject>(
  expr: LogExpr<TContext, TEvent> = defaultLogExpr,
  label?: string
): LogAction<TContext, TEvent> {
  return {
    type: actionTypes.log,
    label,
    expr
  };
}

export const resolveLog = <TContext, TEvent extends EventObject>(
  action: LogAction<TContext, TEvent>,
  ctx: TContext,
  _event: SCXML.Event<TEvent>
): LogActionObject<TContext, TEvent> => ({
  // TODO: remove .expr from resulting object
  ...action,
  value: action.expr(ctx, _event.data, {
    _event
  })
});

/**
 * Cancels an in-flight `send(...)` action. A canceled sent action will not
 * be executed, nor will its event be sent, unless it has already been sent
 * (e.g., if `cancel(...)` is called after the `send(...)` action's `delay`).
 *
 * @param sendId The `id` of the `send(...)` action to cancel.
 */
export const cancel = (sendId: string | number): CancelAction => {
  return {
    type: actionTypes.cancel,
    sendId
  };
};

/**
 * Starts an activity.
 *
 * @param activity The activity to start.
 */
export function start<TContext, TEvent extends EventObject>(
  activity: string | ActivityDefinition<TContext, TEvent>
): ActivityActionObject<TContext, TEvent> {
  const activityDef = toActivityDefinition(activity);

  return {
    type: ActionTypes.Start,
    activity: activityDef,
    exec: undefined
  };
}

/**
 * Stops an activity.
 *
 * @param activity The activity to stop.
 */
export function stop<TContext, TEvent extends EventObject>(
  activity: string | ActivityDefinition<TContext, TEvent>
): ActivityActionObject<TContext, TEvent> {
  const activityDef = toActivityDefinition(activity);

  return {
    type: ActionTypes.Stop,
    activity: activityDef,
    exec: undefined
  };
}

/**
 * Updates the current context of the machine.
 *
 * @param assignment An object that represents the partial context to update.
 */
export const assign = <TContext, TEvent extends EventObject = EventObject>(
  assignment: Assigner<TContext, TEvent> | PropertyAssigner<TContext, TEvent>
): AssignAction<TContext, TEvent> => {
  return {
    type: actionTypes.assign,
    assignment
  };
};

export function isActionObject<TContext, TEvent extends EventObject>(
  action: Action<TContext, TEvent>
): action is ActionObject<TContext, TEvent> {
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
 * @param id The final state node ID
 * @param data The data to pass into the event
 */
export function doneInvoke(id: string, data?: any): DoneEvent {
  const type = `${ActionTypes.DoneInvoke}.${id}`;
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

  return eventObject as (ErrorPlatformEvent & string);
}

export function pure<TContext, TEvent extends EventObject>(
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
 * @param options Options to pass into the send event.
 */
export function forwardTo<TContext, TEvent extends EventObject>(
  target: Required<SendActionOptions<TContext, TEvent>>['to'],
  options?: SendActionOptions<TContext, TEvent>
): SendAction<TContext, TEvent> {
  return send<TContext, TEvent>((_, event) => event, {
    ...options,
    to: target
  });
}
