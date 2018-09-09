import { ActionTypes } from './types';

// xstate-specific action types
export const start = ActionTypes.Start;
export const stop = ActionTypes.Stop;
export const raise = ActionTypes.Raise;
export const send = ActionTypes.Send;
export const cancel = ActionTypes.Cancel;
export const _null = ActionTypes.Null;
export { _null as null };
export const assign = ActionTypes.Assign;
export const after = ActionTypes.After;
export const doneState = ActionTypes.DoneState;
export const log = ActionTypes.Log;
