import {
  MachineImplementations,
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
  definition: MachineConfig<TContext, TEvent, any>,
  implementations?: Partial<MachineImplementations<TContext, TEvent>>
): MachineNode<TContext, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TEvent extends EventObject = AnyEventObject,
  TStateSchema extends StateSchema = any
>(
  definition: MachineConfig<TContext, TEvent, TStateSchema>,
  implementations?: Partial<MachineImplementations<TContext, TEvent>>
): MachineNode<TContext, TEvent, TStateSchema>;
export function Machine<
  TContext = DefaultContext,
  TEvent extends EventObject = AnyEventObject,
  TStateSchema extends StateSchema = any
>(
  definition: MachineConfig<TContext, TEvent, TStateSchema>,
  implementations?: Partial<MachineImplementations<TContext, TEvent>>
): MachineNode<TContext, TEvent, TStateSchema> {
  return new MachineNode<TContext, TEvent, TStateSchema, any>(
    definition,
    implementations
  );
}

export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  definition: MachineConfig<TContext, TEvent, any>,
  implementations?: Partial<MachineImplementations<TContext, TEvent>>
): MachineNode<TContext, TEvent, any, TTypestate> {
  return new MachineNode<TContext, TEvent, TTypestate>(
    definition,
    implementations
  );
}
