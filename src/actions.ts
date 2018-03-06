import {
  Action,
  Event,
  EventType,
  EventObject,
  ActivityAction,
  SendAction,
  SendActionOptions,
  CancelAction
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
