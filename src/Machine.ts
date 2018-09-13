import {
  Machine,
  MachineOptions,
  DefaultContext,
  MachineConfig,
  StateSchema,
  Events
} from './types';
import { StateNode } from './StateNode';

export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvents extends Events = any
>(
  config: MachineConfig<TContext, TStateSchema>,
  options?: MachineOptions<TContext, TEvents>,
  initialContext?: TContext
): Machine<TContext> {
  return new StateNode<TContext, TStateSchema>(
    config,
    options,
    initialContext
  ) as Machine<TContext>;
}
