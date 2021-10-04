import { matchesState } from './utils';
import { mapState } from './mapState';
import { StateNode } from './StateNode';
import { State } from './State';
import { createMachine } from './Machine';
import {
  raise,
  sendParent,
  sendUpdate,
  after,
  done,
  respond,
  doneInvoke,
  forwardTo,
  escalate
} from './actions';
import { choose } from './actions/choose';
import { assign } from './actions/assign';
import { pure } from './actions/pure';
import { send } from './actions/send';
import { cancel } from './actions/cancel';
import { stop } from './actions/stop';
import { log } from './actions/log';
import { interpret, Interpreter, InterpreterStatus } from './interpreter';
import { matchState } from './match';
export { StateMachine as MachineNode } from './StateMachine';
export { SimulatedClock } from './SimulatedClock';
export {
  spawn,
  spawnFrom,
  spawnMachine,
  spawnPromise,
  spawnObservable,
  spawnCallback
} from './actor';
export { createSchema } from './schema';

const actions = {
  raise,
  send,
  sendParent,
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

export {
  StateNode,
  State,
  matchesState,
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
  matchState,
  doneInvoke,
  createMachine
};

export * from './types';

// TODO: decide from where those should be exported
export { pathToStateValue, flatten, keys } from './utils';
export { getStateNodes } from './stateUtils';
