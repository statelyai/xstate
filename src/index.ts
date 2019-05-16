import { matchesState } from './utils';
import { mapState } from './mapState';
import { StateNode } from './StateNode';
import { State } from './State';
import { Machine } from './Machine';
import {
  raise,
  send,
  sendParent,
  log,
  cancel,
  start,
  stop,
  assign,
  after,
  done,
  doneInvoke
} from './actions';
import { interpret, Interpreter, spawn } from './interpreter';
import { matchState } from './match';

const actions = {
  raise,
  send,
  sendParent,
  log,
  cancel,
  start,
  stop,
  assign,
  after,
  done,
  doneInvoke
};

export {
  Machine,
  StateNode,
  State,
  matchesState,
  mapState,
  actions,
  raise,
  send,
  sendParent,
  log,
  cancel,
  start,
  stop,
  assign,
  after,
  done,
  doneInvoke,
  interpret,
  Interpreter,
  matchState,
  spawn
};

export * from './types';
