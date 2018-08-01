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
  config: MachineConfig<TExtState> | ParallelMachineConfig<TExtState>,
  options?: MachineOptions<TExtState>,
  extendedState?: TExtState
): StandardMachine<TExtState> | ParallelMachine<TExtState> {
  return new StateNode<TExtState>(config, options, extendedState) as
    | StandardMachine<TExtState>
    | ParallelMachine<TExtState>;
}
