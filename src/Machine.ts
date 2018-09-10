import {
  Machine,
  MachineOptions,
  DefaultContext,
  MachineConfig,
  StateSchema
} from './types';
import { StateNode } from './StateNode';

export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any
>(
  config: MachineConfig<TContext, TStateSchema>,
  options?: MachineOptions<TContext>,
  initialContext?: TContext
): Machine<TContext> {
  return new StateNode<TContext, TStateSchema>(
    config,
    options,
    initialContext
  ) as Machine<TContext>;
}
