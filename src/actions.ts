import {
  Action,
  Event,
  EventType,
  EventObject,
  ActivityAction,
  SendAction,
  SendActionOptions,
  CancelAction,
  ActionObject,
  ActionType,
  DefaultExtState
} from './types';
import { getEventType } from './utils';

const PREFIX = 'xstate';

// xstate-specific action types
export const actionTypes = {
  start: `${PREFIX}.start`,
  stop: `${PREFIX}.stop`,
  raise: `${PREFIX}.raise`,
  send: `${PREFIX}.send`,
  cancel: `${PREFIX}.cancel`,
  null: `${PREFIX}.null`,
  assign: `${PREFIX}.assign`
};

const createActivityAction = (actionType: string) => (
  activity: ActionType | ActionObject
): ActivityAction => {
  const data =
    typeof activity === 'string' || typeof activity === 'number'
      ? { type: activity }
      : activity;
  return {
    type: actionType,
    activity: getEventType(activity),
    data
  };
};

export const toEventObject = (
  event: Event,
  id?: string | number
): EventObject => {
  if (typeof event === 'string' || typeof event === 'number') {
    const eventObject: EventObject = { type: event };
    if (id !== undefined) {
      eventObject.id = id;
    }

    return eventObject;
  }

  return event;
};

export const toActionObject = (action: Action<any>): ActionObject => {
  let actionObject: ActionObject;

  if (typeof action === 'string' || typeof action === 'number') {
    actionObject = { type: action };
  } else if (typeof action === 'function') {
    actionObject = { type: action.name };
  } else {
    return action;
  }

  Object.defineProperty(actionObject, 'toString', {
    value: () => actionObject.type
  });

  return actionObject;
};

export const toActionObjects = <TExtState = any>(
  action: Array<Action<TExtState> | Action<TExtState>> | undefined
): ActionObject[] => {
  if (!action) {
    return [];
  }

  const actions = Array.isArray(action) ? action : [action];

  return actions.map(toActionObject);
};

export const raise = (eventType: EventType): EventObject => ({
  type: actionTypes.raise,
  event: eventType
});

export const send = (event: Event, options?: SendActionOptions): SendAction => {
  return {
    type: actionTypes.send,
    event: toEventObject(event),
    delay: options ? options.delay : undefined,
    id: options && options.id !== undefined ? options.id : getEventType(event)
  };
};

export const cancel = (sendId: string | number): CancelAction => {
  return {
    type: actionTypes.cancel,
    sendId
  };
};

export const start = createActivityAction(actionTypes.start);
export const stop = createActivityAction(actionTypes.stop);

export type Assigner<TExtState extends {} = {}> = (
  extState: TExtState,
  event: EventObject
) => Partial<TExtState>;
export type PropertyAssigner<T> = Partial<
  { [K in keyof T]: T[K] | ((extState: T, event: EventObject) => T[K]) }
>;

export interface AssignAction<TExtState extends {} = {}> extends ActionObject {
  assignment: Assigner<TExtState> | PropertyAssigner<TExtState>;
}

export const assign = <TExtState = DefaultExtState>(
  assignment: Assigner<TExtState> | PropertyAssigner<TExtState>
): AssignAction<TExtState> => {
  return {
    type: actionTypes.assign,
    assignment
  };
};

export function isActionObject(action: Action<any>): action is ActionObject {
  return typeof action === 'object' && 'type' in action;
}
