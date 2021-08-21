import {
  StateMachine,
  MachineOptions,
  DefaultContext,
  MachineConfig,
  StateSchema,
  EventObject,
  AnyEventObject,
  Typestate,
  BaseActionObject
} from './types';
import { StateNode } from './StateNode';
import { Model } from './model.types';

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
  TAction extends BaseActionObject = BaseActionObject
>(
  // Ensure that models aren't passed in as the first generic type to avoid
  // accidental inference of the model as the `TContext` (which leads to cryptic errors)
  config: TContext extends Model<any, any, any, any>
    ? 'Model type no longer supported as generic type. Please use `model.createMachine(...)` instead.'
    : MachineConfig<TContext, any, TEvent, TAction>,
  options?: Partial<MachineOptions<TContext, TEvent, TAction>>
): StateMachine<TContext, any, TEvent, TTypestate, TAction>;
export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  config: MachineConfig<TContext, any, TEvent>,
  options?: Partial<MachineOptions<TContext, TEvent>>
): StateMachine<TContext, any, TEvent, TTypestate> {
  return new StateNode<TContext, any, TEvent, TTypestate>(
    config,
    options
  ) as StateMachine<TContext, any, TEvent, TTypestate>;
}
