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
  start,
  stop,
  assign,
  after,
  done,
  respond,
  doneInvoke
} from './actions';
import { interpret, Interpreter, spawn } from './interpreter';
import { matchState } from './match';

const actions = {
  raise,
  send,
  sendParent,
  sendUpdate,
  log,
  cancel,
  start,
  stop,
  assign,
  after,
  done,
  respond
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
  interpret,
  Interpreter,
  matchState,
  spawn,
  doneInvoke,
  createMachine
};

export * from './types';
