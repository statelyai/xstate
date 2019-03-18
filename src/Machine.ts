import {
  StateMachine,
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
  TEvent extends EventObject = EventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>,
  initialContext: TContext | undefined = config.context
): StateMachine<TContext, TStateSchema, TEvent> {
  return new StateNode<TContext, TStateSchema, TEvent>(
    config,
    options,
    initialContext
  ) as StateMachine<TContext, TStateSchema, TEvent>;
}
