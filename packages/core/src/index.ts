import {
  after,
  done,
  doneInvoke,
  escalate,
  forwardTo,
  respond,
  sendParent,
  sendTo
} from './actions';
import { assign } from './actions/assign';
import { cancel } from './actions/cancel';
import { choose } from './actions/choose';
import { log } from './actions/log';
import { pure } from './actions/pure';
import { raise } from './actions/raise';
import { send } from './actions/send';
import { stop } from './actions/stop';
import { interpret, Interpreter, ActorStatus } from './interpreter';
import { createMachine } from './Machine';
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
  forwardTo,
  interpret,
  Interpreter,
  ActorStatus as InterpreterStatus,
  doneInvoke,
  createMachine
};

const actions = {
  raise,
  send,
  sendParent,
  sendTo,
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
