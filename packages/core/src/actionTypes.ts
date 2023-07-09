import { ActionTypes } from './types.ts';

// xstate-specific action types
export const stop = ActionTypes.Stop;
export const raise = ActionTypes.Raise;
export const sendTo = ActionTypes.SendTo;
export const cancel = ActionTypes.Cancel;
export const assign = ActionTypes.Assign;
export const after = ActionTypes.After;
export const doneState = ActionTypes.DoneState;
export const log = ActionTypes.Log;
export const init = ActionTypes.Init;
export const invoke = ActionTypes.Invoke;
export const errorExecution = ActionTypes.ErrorExecution;
export const errorPlatform = ActionTypes.ErrorPlatform;
export const error = ActionTypes.ErrorCustom;
export const choose = ActionTypes.Choose;
export const pure = ActionTypes.Pure;
