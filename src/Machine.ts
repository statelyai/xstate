import {
  Machine,
  MachineOptions,
  DefaultContext,
  MachineConfig
} from './types';
import { StateNode } from './StateNode';

export function Machine<TContext = DefaultContext>(
  config: MachineConfig<TContext>,
  options?: MachineOptions<TContext>,
  extendedState?: TContext
): Machine<TContext> {
  return new StateNode<TContext>(config, options, extendedState) as Machine<
    TContext
  >;
}
