import { matchesState } from './utils';
import { mapState } from './mapState';
import { StateNode } from './StateNode';
import { State } from './State';
import { Machine, createMachine } from './Machine';
import {
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
  doneInvoke,
  forwardTo,
  escalate,
  choose,
  pure
} from './actions';
import { interpret, Interpreter } from './interpreter';
import { matchState } from './match';
export { MachineNode } from './MachineNode';
export { SimulatedClock } from './SimulatedClock';

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
  Machine,
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
  matchState,
  doneInvoke,
  createMachine
};

export * from './types';

// TODO: decide from where those should be exported
export { pathToStateValue, flatten, keys } from './utils';
export { getStateNodes } from './stateUtils';
export { toMachine } from './scxml';
