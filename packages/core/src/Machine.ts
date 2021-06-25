import {
  MachineImplementations,
  MachineConfig,
  EventObject,
  AnyEventObject,
  Typestate,
  MachineContext
} from './types';
import { StateMachine } from './StateMachine';
import { Model, ModelContextFrom, ModelEventsFrom } from './model';

export function createMachine<
  TModel extends Model<any, any, any>,
  TContext extends MachineContext = ModelContextFrom<TModel>,
  TEvent extends EventObject = ModelEventsFrom<TModel>,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  config: MachineConfig<TContext, TEvent> & { context: TContext },
  options?: Partial<MachineImplementations<TContext, TEvent>>
): StateMachine<TContext, TEvent, TTypestate>;
export function createMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  config: TContext extends Model<any, any, any>
    ? never
    : MachineConfig<TContext, TEvent>,
  options?: Partial<MachineImplementations<TContext, TEvent>>
): StateMachine<TContext, TEvent, TTypestate>;
export function createMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  definition: MachineConfig<TContext, TEvent>,
  implementations?: Partial<MachineImplementations<TContext, TEvent>>
): StateMachine<TContext, TEvent, TTypestate> {
  return new StateMachine<TContext, TEvent, TTypestate>(
    definition,
    implementations
  );
}
