import { matchesState } from './utils';
import { mapState } from './mapState';
import { StateNode } from './StateNode';
import { State } from './State';
import { Machine, createMachine } from './Machine';
import { Actor, toActorRef } from './Actor';
import * as actions from './actions';
import {
  interpret,
  Interpreter,
  spawn,
  InterpreterStatus
} from './interpreter';
import { matchState } from './match';
import { createSchema, t } from './schema';

const { assign, send, sendParent, sendUpdate, forwardTo, doneInvoke } = actions;

export {
  Actor,
  toActorRef,
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
  InterpreterStatus,
  matchState,
  spawn,
  doneInvoke,
  createMachine,
  createSchema,
  t
};

export * from './types';
export * from './typegenTypes';

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}
