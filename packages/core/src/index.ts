export * from './actions.ts';
export * from './actors/index.ts';
export { SimulatedClock } from './SimulatedClock.ts';
export { type Spawner } from './spawn.ts';
export { StateMachine, type MachineSnapshot } from './StateMachine.ts';
export { getStateNodes } from './stateUtils.ts';
export * from './typegenTypes.ts';
export * from './types.ts';
export { waitFor } from './waitFor.ts';
import { Actor, createActor, interpret, Interpreter } from './interpreter.ts';
import { createMachine } from './Machine.ts';
import { State } from './State.ts';
import { StateNode } from './StateNode.ts';
// TODO: decide from where those should be exported
export { matchesState, pathToStateValue, toObserver } from './utils.ts';
export {
  Actor,
  createActor,
  createMachine,
  interpret,
  State,
  StateNode,
  type Interpreter
};
export type {
  InspectedActorEvent,
  InspectedEventEvent,
  InspectedSnapshotEvent,
  InspectionEvent
} from './system.ts';

export { and, not, or, stateIn } from './guards.ts';

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}
