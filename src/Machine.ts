import {
  Machine,
  StandardMachine,
  ParallelMachine,
  MachineConfig,
  ParallelMachineConfig
} from './types';
import { StateNode } from './StateNode';

export function Machine(
  config: MachineConfig | ParallelMachineConfig
): StandardMachine | ParallelMachine {
  return new StateNode(config) as StandardMachine | ParallelMachine;
}
