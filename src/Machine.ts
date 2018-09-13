import {
  Machine,
  MachineOptions,
  DefaultContext,
  MachineConfig,
  StateSchema,
  EventObject
} from './types';
import { StateNode } from './StateNode';

export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvents extends EventObject = EventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvents>,
  options?: MachineOptions<TContext, TEvents>,
  initialContext?: TContext
): Machine<TContext> {
  return new StateNode<TContext, TStateSchema, TEvents>(
    config,
    options,
    initialContext
  ) as Machine<TContext>;
}
