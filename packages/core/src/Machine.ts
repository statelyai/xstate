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
import { Model, ModelContextFrom, ModelEventsFrom } from './model';

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
  TModel extends Model<any, any, any>,
  TContext = ModelContextFrom<TModel>,
  TEvent extends EventObject = ModelEventsFrom<TModel>,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  config: MachineConfig<TContext, TEvent, any>,
  options?: Partial<MachineImplementations<TContext, TEvent>>
): MachineNode<TContext, TEvent, any, TTypestate>;
export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  config: MachineConfig<TContext, TEvent, any>,
  options?: Partial<MachineImplementations<TContext, TEvent>>
): MachineNode<TContext, TEvent, any, TTypestate>;
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
