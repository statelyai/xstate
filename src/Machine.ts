import {
  Machine,
  MachineOptions,
  DefaultContext,
  MachineConfig,
  StateSchema,
  EventObject,
  AnyEvent
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
): Machine<TContext, TStateSchema, AnyEvent<TEvents>> {
  return new StateNode<TContext, TStateSchema, AnyEvent<TEvents>>(
    config,
    options,
    initialContext
  ) as Machine<TContext, TStateSchema, AnyEvent<TEvents>>;
}
