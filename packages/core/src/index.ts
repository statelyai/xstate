import * as actions from './actions';
import { Actor, toActorRef } from './Actor';
import {
  interpret,
  Interpreter,
  InterpreterStatus,
  spawn
} from './interpreter';
import { createMachine, Machine } from './Machine';
import { mapState } from './mapState';
import { matchState } from './match';
import { createSchema, t } from './schema';
import { State } from './State';
import { StateNode } from './StateNode';
export { spawnBehavior } from './behaviors';
export { XStateDevInterface } from './devTools';
export * from './typegenTypes';
export * from './types';
export { matchesState, toEventObject, toObserver, toSCXMLEvent } from './utils';
export {
  Actor,
  toActorRef,
  Machine,
  StateNode,
  State,
  mapState,
  actions,
  assign,
  send,
  sendTo,
  sendParent,
  sendUpdate,
  raise,
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

const {
  assign,
  send,
  sendTo,
  sendParent,
  sendUpdate,
  forwardTo,
  doneInvoke,
  raise
} = actions;

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}
