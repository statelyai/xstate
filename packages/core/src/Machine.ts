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
  config: MachineConfig<TContext, any, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>,
  initialContext?: TContext
): MachineNode<TContext, any, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>,
  initialContext?: TContext
): MachineNode<TContext, TStateSchema, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>
): MachineNode<TContext, TStateSchema, TEvent> {
  return new MachineNode<TContext, TStateSchema, TEvent, any>(
    config,
    options
  ) as MachineNode<TContext, TStateSchema, TEvent>;
}

export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = any
>(
  config: MachineConfig<TContext, any, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>
): MachineNode<TContext, any, TEvent, TTypestate> {
  return new MachineNode<TContext, any, TEvent, TTypestate>(config, options);
}
