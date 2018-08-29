import {
  Machine,
  StandardMachine,
  ParallelMachine,
  MachineConfig,
  ParallelMachineConfig,
  MachineOptions,
  DefaulTContext
} from './types';
import { StateNode } from './StateNode';

export function Machine<TContext = DefaulTContext>(
  config: MachineConfig<TContext> | ParallelMachineConfig<TContext>,
  options?: MachineOptions<TContext>,
  extendedState?: TContext
): StandardMachine<TContext> | ParallelMachine<TContext> {
  return new StateNode<TContext>(config, options, extendedState) as
    | StandardMachine<TContext>
    | ParallelMachine<TContext>;
}
