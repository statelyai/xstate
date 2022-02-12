import {
  MachineImplementations,
  MachineConfig,
  EventObject,
  AnyEventObject,
  MachineContext
} from './types';
import { StateMachine } from './StateMachine';

export function createMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject
>(
  definition: MachineConfig<TContext, TEvent>,
  implementations?: Partial<MachineImplementations<TContext, TEvent>>
): StateMachine<TContext, TEvent> {
  return new StateMachine<TContext, TEvent>(definition, implementations);
}
