import { ActionObject, Action, ActionType } from './types';
import { getEventType } from './utils';

const PREFIX = 'xstate';

// xstate-specific action types
export const actionTypes = {
  start: `${PREFIX}.start`,
  stop: `${PREFIX}.stop`
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

export const start = createActivityAction(actionTypes.start);
export const stop = createActivityAction(actionTypes.stop);
