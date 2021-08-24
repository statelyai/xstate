import { ActionTypes } from './types';

// xstate-specific action types
export const XSTATE_START = ActionTypes.Start;
export const XSTATE_STOP = ActionTypes.Stop;
export const XSTATE_RAISE = ActionTypes.Raise;
export const XSTATE_SEND = ActionTypes.Send;
export const XSTATE_CANCEL = ActionTypes.Cancel;
export const XSTATE_ASSIGN = ActionTypes.Assign;
export const XSTATE_AFTER = ActionTypes.After;
export const XSTATE_LOG = ActionTypes.Log;
export const XSTATE_INIT = ActionTypes.Init;
export const XSTATE_INVOKE = ActionTypes.Invoke;
export const XSTATE_ERROR = ActionTypes.ErrorCustom;
export const XSTATE_UPDATE = ActionTypes.Update;
export const XSTATE_CHOOSE = ActionTypes.Choose;
export const XSTATE_PURE = ActionTypes.Pure;

export const NULL_EVENT = ActionTypes.NullEvent;
export const DONE_START = ActionTypes.DoneState;

export const ERROR_EXECUTION = ActionTypes.ErrorExecution;
export const ERROR_PLATFORM = ActionTypes.ErrorPlatform;
