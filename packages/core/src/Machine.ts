import {
  StateMachine,
  MachineOptions,
  DefaultContext,
  MachineConfig,
  StateSchema,
  EventObject,
  AnyEventObject,
  Typestate
} from './types';
import { StateNode } from './StateNode';

export function Machine<
  TContext = DefaultContext,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, any, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>,
  initialContext?: TContext
): StateMachine<TContext, any, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>,
  initialContext?: TContext
): StateMachine<TContext, TStateSchema, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>,
  initialContext: TContext | undefined = config.context
): StateMachine<TContext, TStateSchema, TEvent> {
  return new StateNode<TContext, TStateSchema, TEvent, any>(
    config,
    options,
    initialContext
  ) as StateMachine<TContext, TStateSchema, TEvent, any>;
}

export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TState extends Typestate<TContext> = any
>(
  config: MachineConfig<TContext, any, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>
): StateMachine<TContext, any, TEvent, TState> {
  return new StateNode<TContext, any, TEvent, TState>(
    config,
    options
  ) as StateMachine<TContext, any, TEvent, TState>;
}
