import { ExtraGenerics } from '.';
import { Model } from './model.types';
import { StateNode } from './StateNode';
import {
  AnyEventObject,
  DefaultContext,
  EventObject,
  MachineConfig,
  MachineOptions,
  StateMachine,
  StateSchema,
  Typestate
} from './types';

/**
 * @deprecated Use `createMachine(...)` instead.
 */
export function Machine<
  TContext = any,
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
  initialContext: TContext | (() => TContext) | undefined = config.context
): StateMachine<TContext, TStateSchema, TEvent> {
  return new StateNode<TContext, TStateSchema, TEvent>(
    config,
    options,
    initialContext
  ) as StateMachine<TContext, TStateSchema, TEvent>;
}

export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TExtra extends ExtraGenerics = {}
>(
  config: TContext extends Model<any, any, any, any>
    ? 'Model type no longer supported as generic type. Please use `model.createMachine(...)` instead.'
    : MachineConfig<TContext, any, TEvent, TExtra>,
  options?: Partial<MachineOptions<TContext, TEvent, TExtra>>
): StateMachine<TContext, any, TEvent, TTypestate>;
export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TExtra extends ExtraGenerics = {}
>(
  config: MachineConfig<TContext, any, TEvent, TExtra>,
  options?: Partial<MachineOptions<TContext, TEvent, TExtra>>
): StateMachine<TContext, any, TEvent, TTypestate> {
  return new StateNode<TContext, any, TEvent, TTypestate>(
    config,
    options
  ) as StateMachine<TContext, any, TEvent, TTypestate>;
}
