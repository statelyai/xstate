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
  InvokeDefinition,
  RaiseEvent,
  Machine,
  DoneEvent,
  InvokeConfig,
  ErrorExecutionEvent
} from './types';
import * as actionTypes from './actionTypes';
import { getEventType } from './utils';

export { actionTypes };

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

function getActionFunction<TContext>(
  actionType: ActionType,
  actionFunctionMap?: ActionFunctionMap<TContext>
): ActionFunction<TContext> | undefined {
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

  return actionReference.exec;
}

export function toActionObject<TContext>(
  action: Action<TContext>,
  actionFunctionMap?: ActionFunctionMap<TContext>
): ActionObject<TContext> {
  let actionObject: ActionObject<TContext>;

  if (typeof action === 'string' || typeof action === 'number') {
    actionObject = {
      type: action,
      exec: getActionFunction(action, actionFunctionMap)
    };
  } else if (typeof action === 'function') {
    actionObject = {
      type: action.name,
      exec: action
    };
  } else {
    const exec = getActionFunction(action.type, actionFunctionMap);
    return exec
      ? {
          ...action,
          exec
        }
      : action;
  }

  Object.defineProperty(actionObject, 'toString', {
    value: () => actionObject.type,
    enumerable: false
  });

  return actionObject;
}

export function toActivityDefinition<TContext>(
  action: string | ActivityDefinition<TContext>
): ActivityDefinition<TContext> {
  const actionObject = toActionObject(action);

  return {
    id: typeof action === 'string' ? action : actionObject.id,
    ...actionObject,
    type: actionObject.type
  };
}

export const toActionObjects = <TContext>(
  action: Array<Action<TContext> | Action<TContext>> | undefined,
  actionFunctionMap?: ActionFunctionMap<TContext>
): Array<ActionObject<TContext>> => {
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
  event: Event<TEvent>,
  options?: SendActionOptions
): SendAction<TContext, TEvent> {
  return {
    to: options ? options.to : undefined,
    type: actionTypes.send,
    event: toEventObject<TEvent>(event),
    delay: options ? options.delay : undefined,
    id:
      options && options.id !== undefined
        ? options.id
        : (getEventType<TEvent>(event) as string)
  };
}

/**
 * Sends an event to this machine's parent machine.
 *
 * @param event The event to send to the parent machine.
 * @param options Options to pass into the send event.
 */
export function sendParent<TContext, TEvent extends EventObject>(
  event: Event<TEvent>,
  options?: SendActionOptions
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
export function start<TContext>(
  activity: string | ActivityDefinition<TContext>
): ActivityActionObject<TContext> {
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
export function stop<TContext>(
  activity: string | ActivityDefinition<TContext>
): ActivityActionObject<TContext> {
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

export function isActionObject<TContext>(
  action: Action<TContext>
): action is ActionObject<TContext> {
  return typeof action === 'object' && 'type' in action;
}

/**
 * Returns an event type that represents an implicit event that
 * is sent after the specified `delay`.
 *
 * @param delay The delay in milliseconds
 * @param id The state node ID where this event is handled
 */
export function after(delay: number, id?: string) {
  const idSuffix = id ? `#${id}` : '';
  return `${ActionTypes.After}(${delay})${idSuffix}`;
}

/**
 * Returns an event that represents that a final state node
 * has been reached.
 *
 * @param id The final state node ID
 * @param data The data to pass into the event
 */
export function done(id: string, data?: any): DoneEvent {
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

/**
 * Invokes (spawns) a child service, as a separate interpreted machine.
 *
 * @param invokeConfig The string service to invoke, or a config object:
 *  - `src` - The source (URL) of the machine definition to invoke
 *  - `forward` - Whether events sent to this machine are sent (forwarded) to the
 *    invoked machine.
 * @param options
 */
export function invoke<TContext, TEvent extends EventObject>(
  invokeConfig:
    | string
    | InvokeConfig<TContext, TEvent>
    | Machine<any, any, any>,
  options?: Partial<InvokeDefinition<TContext, TEvent>>
): InvokeDefinition<TContext, TEvent> {
  if (typeof invokeConfig === 'string') {
    return {
      id: invokeConfig,
      src: invokeConfig,
      type: ActionTypes.Invoke,
      ...options
    };
  }

  if (!('src' in invokeConfig)) {
    const machine = invokeConfig as Machine<any, any, any>;

    return {
      type: ActionTypes.Invoke,
      id: machine.id,
      src: machine
    };
  }

  return {
    type: ActionTypes.Invoke,
    ...invokeConfig,
    id:
      invokeConfig.id ||
      (typeof invokeConfig.src === 'string'
        ? invokeConfig.src
        : typeof invokeConfig.src === 'function'
          ? 'promise'
          : invokeConfig.src.id)
  };
}

export function error(data: any): ErrorExecutionEvent {
  return {
    type: ActionTypes.ErrorExecution,
    data
  };
}
