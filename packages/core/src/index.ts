import {
  after,
  done,
  doneInvoke,
  escalate,
  forwardTo,
  respond,
  sendParent,
  sendTo,
  sendUpdate
} from './actions';
import { assign } from './actions/assign';
import { cancel } from './actions/cancel';
import { choose } from './actions/choose';
import { log } from './actions/log';
import { pure } from './actions/pure';
import { raise } from './actions/raise';
import { send } from './actions/send';
import { stop } from './actions/stop';
import { interpret, Interpreter, InterpreterStatus } from './interpreter';
import { createMachine, createMachine2 } from './StateMachine';
import { mapState } from './mapState';
import { State } from './State';
import { StateNode } from './StateNode';
export { createSchema, t } from './schema';
export { SimulatedClock } from './SimulatedClock';
export { StateMachine } from './StateMachine';
export { getStateNodes } from './stateUtils';
export * from './typegenTypes';
export * from './types';
// TODO: decide from where those should be exported
export {
  matchesState,
  pathToStateValue,
  toEventObject,
  toObserver,
  toSCXMLEvent
} from './utils';
export {
  StateNode,
  State,
  mapState,
  actions,
  assign,
  send,
  sendParent,
  sendUpdate,
  forwardTo,
  interpret,
  Interpreter,
  InterpreterStatus,
  doneInvoke,
  createMachine,
  createMachine2
};

const actions = {
  raise,
  send,
  sendParent,
  sendTo,
  sendUpdate,
  log,
  cancel,
  stop,
  assign,
  after,
  done,
  respond,
  forwardTo,
  escalate,
  choose,
  pure
};

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}
