import {
  ActionObject,
  Action,
  ActionType,
  Event,
  EventType,
  EventObject
} from './types';
import { getEventType } from './utils';

const PREFIX = 'xstate';

// xstate-specific action types
export const actionTypes = {
  start: `${PREFIX}.start`,
  stop: `${PREFIX}.stop`,
  raise: `${PREFIX}.raise`,
  send: `${PREFIX}.send`,
  cancel: `${PREFIX}.cancel`
};

export interface ActivityAction extends ActionObject {
  activity: ActionType;
  data: {
    type: ActionType;
    [key: string]: any;
  };
}

const createActivityAction = (actionType: string) => (
  activity: Action
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

export const toEventObject = (event: Event): EventObject => {
  if (typeof event === 'string' || typeof event === 'number') {
    return { type: event };
  }

  return event;
};

export const raise = (eventType: EventType): EventObject => ({
  type: actionTypes.raise,
  event: eventType
});

export interface SendAction extends ActionObject {
  event: EventObject;
  delay?: number;
}
export interface SendActionOptions {
  delay?: number;
  id?: string | number;
}

export const send = (event: Event, options?: SendActionOptions): SendAction => {
  return {
    type: actionTypes.send,
    event: toEventObject(event),
    delay: options ? options.delay : undefined,
    id: options && options.id !== undefined ? options.id : getEventType(event)
  };
};

export interface CancelAction extends ActionObject {
  sendId: string | number;
}

export const cancel = (sendId: string | number): CancelAction => {
  return {
    type: actionTypes.cancel,
    sendId
  };
};

export const start = createActivityAction(actionTypes.start);
export const stop = createActivityAction(actionTypes.stop);
