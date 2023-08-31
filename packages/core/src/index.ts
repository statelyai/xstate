import { createMachine } from './Machine.ts';
import { State } from './State.ts';
import { StateNode } from './StateNode.ts';
import { doneInvoke, forwardTo, sendParent, sendTo } from './actions.ts';
import {
  Actor,
  ActorStatus,
  Interpreter,
  InterpreterStatus,
  createActor,
  interpret
} from './interpreter.ts';
import { mapState } from './mapState.ts';
export { SimulatedClock } from './SimulatedClock.ts';
export { StateMachine } from './StateMachine.ts';
export {
  assign,
  type AssignArgs,
  type AssignAction
} from './actions/assign.ts';
export { cancel } from './actions/cancel.ts';
export { choose } from './actions/choose.ts';
export { log } from './actions/log.ts';
export { pure } from './actions/pure.ts';
export { raise } from './actions/raise.ts';
export { stop } from './actions/stop.ts';
export {
  fromCallback,
  fromEventObservable,
  fromObservable,
  fromPromise,
  fromTransition
} from './actors/index.ts';
export { and, not, or, stateIn } from './guards.ts';
export { type Spawner } from './spawn.ts';
export { getStateNodes } from './stateUtils.ts';
export * from './typegenTypes.ts';
export * from './types.ts';
// TODO: decide from where those should be exported
export { matchesState, pathToStateValue, toObserver } from './utils.ts';
export { waitFor } from './waitFor.ts';
export {
  StateNode,
  State,
  mapState,
  sendTo,
  sendParent,
  forwardTo,
  createActor,
  interpret,
  Actor,
  type Interpreter,
  ActorStatus,
  InterpreterStatus,
  doneInvoke,
  createMachine
};

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}
