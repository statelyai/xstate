import {
  after,
  done,
  doneInvoke,
  escalate,
  forwardTo,
  respond,
  sendParent,
  sendTo
} from './actions.ts';
import { assign } from './actions/assign.ts';
import { cancel } from './actions/cancel.ts';
import { choose } from './actions/choose.ts';
import { log } from './actions/log.ts';
import { pure } from './actions/pure.ts';
import { raise } from './actions/raise.ts';
import { send } from './actions/send.ts';
import { stop } from './actions/stop.ts';
import { interpret, Interpreter, ActorStatus } from './interpreter.ts';
import { createMachine } from './Machine.ts';
import { mapState } from './mapState.ts';
import { State } from './State.ts';
import { StateNode } from './StateNode.ts';
export { SimulatedClock } from './SimulatedClock.ts';
export { StateMachine } from './StateMachine.ts';
export { getStateNodes } from './stateUtils.ts';
export * from './typegenTypes.ts';
export * from './types.ts';
// TODO: decide from where those should be exported
export {
  matchesState,
  pathToStateValue,
  toObserver,
  toSCXMLEvent
} from './utils.ts';
export {
  StateNode,
  State,
  mapState,
  actions,
  assign,
  send,
  sendTo,
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
