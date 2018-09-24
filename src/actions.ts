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
  Invocation
} from './types';
import * as actionTypes from './actionTypes';
import { getEventType } from './utils';

export { actionTypes };

export function toEventObject<TEvents extends EventObject>(
  event: Event<TEvents>
  // id?: TEvents['type']
): TEvents {
  if (typeof event === 'string' || typeof event === 'number') {
    const eventObject = { type: event };
    // if (id !== undefined) {
    //   eventObject.id = id;
    // }

    return eventObject as TEvents;
  }

  return event as TEvents;
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

export const toActionObject = <TContext>(
  action: Action<TContext>,
  actionFunctionMap?: ActionFunctionMap<TContext>
): ActionObject<TContext> => {
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
};

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

interface RaiseEvent<TContext, TEvents extends EventObject>
  extends ActionObject<TContext> {
  event: TEvents['type'];
}

export function raise<TContext, TEvents extends EventObject>(
  eventType: TEvents['type']
): RaiseEvent<TContext, TEvents> {
  return {
    type: actionTypes.raise,
    event: eventType
  };
}

export function send<TContext, TEvents extends EventObject>(
  event: Event<TEvents>,
  options?: SendActionOptions
): SendAction<TContext, TEvents> {
  return {
    target: options ? options.target : undefined,
    type: actionTypes.send,
    event: toEventObject<TEvents>(event),
    delay: options ? options.delay : undefined,
    id:
      options && options.id !== undefined
        ? options.id
        : (getEventType<TEvents>(event) as string)
  };
}

export function sendParent<TContext, TEvents extends EventObject>(
  event: Event<TEvents>,
  options?: SendActionOptions
): SendAction<TContext, TEvents> {
  return send<TContext, TEvents>(event, {
    ...options,
    target: SpecialTargets.Parent
  });
}

export function log<TContext, TEvents extends EventObject>(
  expr: (ctx: TContext, event: TEvents) => void,
  label?: string
) {
  return {
    type: actionTypes.log,
    label,
    expr
  };
}

export const cancel = (sendId: string | number): CancelAction => {
  return {
    type: actionTypes.cancel,
    sendId
  };
};

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

export const assign = <TContext, TEvents extends EventObject = EventObject>(
  assignment: Assigner<TContext, TEvents> | PropertyAssigner<TContext, TEvents>
): AssignAction<TContext, TEvents> => {
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

export function after(delay: number, id?: string) {
  const idSuffix = id ? `#${id}` : '';
  return `${ActionTypes.After}(${delay})${idSuffix}`;
}

export function done(id: string) {
  return `${ActionTypes.DoneState}.${id}`;
}

export function invoke<TContext>(
  invokeConfig: string | Invocation<TContext>,
  options?: Partial<Invocation<TContext>>
): ActivityDefinition<TContext> {
  if (typeof invokeConfig === 'string') {
    return {
      id: invokeConfig,
      src: invokeConfig,
      type: ActionTypes.Invoke,
      ...options
    };
  }

  return invokeConfig;
}
