import {
  Machine,
  StandardMachine,
  ParallelMachine,
  MachineConfig,
  ParallelMachineConfig,
  MachineOptions
} from './types';
import { StateNode } from './StateNode';

export function Machine<TExtState extends {} = {}>(
  config: MachineConfig | ParallelMachineConfig,
  options?: MachineOptions
): StandardMachine | ParallelMachine {
  return new StateNode<TExtState>(config, options) as
    | StandardMachine
    | ParallelMachine;
}
