import {
  MachineOptions,
  DefaultContext,
  MachineConfig,
  StateSchema,
  EventObject,
  AnyEventObject,
  Typestate
} from './types';
import { MachineNode } from './MachineNode';

export function Machine<
  TContext = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, TEvent, any>,
  options?: Partial<MachineOptions<TContext, TEvent>>
): MachineNode<TContext, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TEvent extends EventObject = AnyEventObject,
  TStateSchema extends StateSchema = any
>(
  config: MachineConfig<TContext, TEvent, TStateSchema>,
  options?: Partial<MachineOptions<TContext, TEvent>>
): MachineNode<TContext, TEvent, TStateSchema>;
export function Machine<
  TContext = DefaultContext,
  TEvent extends EventObject = AnyEventObject,
  TStateSchema extends StateSchema = any
>(
  config: MachineConfig<TContext, TEvent, TStateSchema>,
  options?: Partial<MachineOptions<TContext, TEvent>>
): MachineNode<TContext, TEvent, TStateSchema> {
  return new MachineNode<TContext, TEvent, TStateSchema, any>(config, options);
}

export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  config: MachineConfig<TContext, TEvent, any>,
  options?: Partial<MachineOptions<TContext, TEvent>>
): MachineNode<TContext, TEvent, TTypestate> {
  return new MachineNode<TContext, TEvent, TTypestate>(config, options);
}
