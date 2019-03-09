import {
  Action,
  Event,
  EventObject,
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
  RaiseEvent,
  DoneEvent,
  ErrorExecutionEvent,
  DoneEventObject,
  SendExpr,
  SendActionObject,
  OmniEventObject
} from './types';
import * as actionTypes from './actionTypes';
import { getEventType } from './utils';

export { actionTypes };

export const initEvent = { type: actionTypes.init } as {
  type: ActionTypes.Init;
};

export function toEventObject<TEvent extends EventObject>(
  event: Event<TEvent>
  // id?: TEvent['type']
): TEvent {
  if (typeof event === 'string' || typeof event === 'number') {
    const eventObject = { type: event };
    // if (id !== undefined) {
    //   eventObject.id = id;
    // }

    return eventObject as TEvent;
  }

  return event as TEvent;
}

function getActionFunction<TContext, TEvent extends EventObject>(
  actionType: ActionType,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
):
  | ActionObject<TContext, TEvent>
  | ActionFunction<TContext, TEvent>
  | undefined {
  if (!actionFunctionMap) {
    return undefined;
  }
  const actionReference = actionFunctionMap[actionType];

  if (!actionReference) {
    return undefined;
  }

  if (typeof actionReference === 'function') {
    return actionReference;
  }

  return actionReference;
}

export function toActionObject<TContext, TEvent extends EventObject>(
  action: Action<TContext, TEvent>,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): ActionObject<TContext, TEvent> {
  let actionObject: ActionObject<TContext, TEvent>;

  if (typeof action === 'string' || typeof action === 'number') {
    const exec = getActionFunction(action, actionFunctionMap);
    if (typeof exec === 'function') {
      actionObject = {
        type: action,
        exec
      };
    } else if (exec) {
      actionObject = exec;
    } else {
      actionObject = { type: action, exec: undefined };
    }
  } else if (typeof action === 'function') {
    actionObject = {
      // Convert action to string if unnamed
      type: action.name || action.toString(),
      exec: action
    };
  } else {
    const exec = getActionFunction(action.type, actionFunctionMap);
    if (typeof exec === 'function') {
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

export function toActivityDefinition<TContext, TEvent extends EventObject>(
  action: string | ActivityDefinition<TContext, TEvent>
): ActivityDefinition<TContext, TEvent> {
  const actionObject = toActionObject(action);

  return {
    id: typeof action === 'string' ? action : actionObject.id,
    ...actionObject,
    type: actionObject.type
  };
}

export const toActionObjects = <TContext, TEvent extends EventObject>(
  action:
    | Array<Action<TContext, TEvent> | Action<TContext, TEvent>>
    | undefined,
  actionFunctionMap?: ActionFunctionMap<TContext, TEvent>
): Array<ActionObject<TContext, TEvent>> => {
  if (!action) {
    return [];
  }

  const actions = Array.isArray(action) ? action : [action];

  return actions.map(subAction => toActionObject(subAction, actionFunctionMap));
};

/**
 * Raises an event. This places the event in the internal event queue, so that
 * the event is immediately consumed by the machine in the current step.
 *
 * @param eventType The event to raise.
 */
export function raise<TContext, TEvent extends EventObject>(
  event: Event<TEvent>
): RaiseEvent<TContext, TEvent> {
  return {
    type: actionTypes.raise,
    event
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
    event: typeof event === 'function' ? event : toEventObject<TEvent>(event),
    delay: options ? options.delay : undefined,
    id:
      options && options.id !== undefined
        ? options.id
        : typeof event === 'function'
        ? event.name
        : (getEventType<TEvent>(event) as string)
  };
}

export function resolveSend<TContext, TEvent extends EventObject>(
  action: SendAction<TContext, TEvent>,
  ctx: TContext,
  event: TEvent
): SendActionObject<TContext, OmniEventObject<TEvent>> {
  // TODO: helper function for resolving Expr
  const resolvedEvent =
    typeof action.event === 'function'
      ? toEventObject(action.event(ctx, event) as OmniEventObject<TEvent>)
      : toEventObject(action.event);
  const resolvedDelay =
    typeof action.delay === 'function'
      ? action.delay(ctx, event)
      : action.delay;

  return {
    ...action,
    event: resolvedEvent,
    delay: resolvedDelay
  };
}

/**
 * Sends an event to this machine's parent machine.
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
 *
 * @param expr The expression function to evaluate which will be logged.
 *  Takes in 2 arguments:
 *  - `ctx` - the current state context
 *  - `event` - the event that caused this action to be executed.
 * @param label The label to give to the logged expression.
 */
export function log<TContext, TEvent extends EventObject>(
  expr: (ctx: TContext, event: TEvent) => any = (context, event) => ({
    context,
    event
  }),
  label?: string
) {
  return {
    type: actionTypes.log,
    label,
    expr
  };
}

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

export function error(data: any, src: string): ErrorExecutionEvent {
  return {
    src,
    type: ActionTypes.ErrorExecution,
    data
  };
}
