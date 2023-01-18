import {
  after,
  done,
  doneInvoke,
  escalate,
  forwardTo,
  respond,
  sendParent,
  sendTo
} from './actions.js';
import { assign } from './actions/assign.js';
import { cancel } from './actions/cancel.js';
import { choose } from './actions/choose.js';
import { log } from './actions/log.js';
import { pure } from './actions/pure.js';
import { raise } from './actions/raise.js';
import { send } from './actions/send.js';
import { stop } from './actions/stop.js';
import { interpret, Interpreter, ActorStatus } from './interpreter.js';
import { createMachine } from './Machine.js';
import { mapState } from './mapState.js';
import { State } from './State.js';
import { StateNode } from './StateNode.js';
export { createSchema, t } from './schema.js';
export { SimulatedClock } from './SimulatedClock.js';
export { StateMachine } from './StateMachine.js';
export { getStateNodes } from './stateUtils.js';
export * from './typegenTypes.js';
export * from './types.js';
// TODO: decide from where those should be exported
export {
  matchesState,
  pathToStateValue,
  toObserver,
  toSCXMLEvent
} from './utils.js';
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
