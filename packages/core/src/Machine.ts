import { Model } from './model.types';
import { StateNode } from './StateNode';
import {
  ActionObject,
  AnyEventObject,
  BaseActionObject,
  DefaultContext,
  EventObject,
  MachineConfig,
  MachineOptions,
  StateMachine,
  StateSchema,
  Typestate
} from './types';
import {
  MaybeTypegenMachineOptions,
  TypegenConstraint,
  TypegenDisabled,
  ResolveTypegenMeta
} from './typegenTypes';

/**
 * @deprecated Use `createMachine(...)` instead.
 */
export function Machine<
  TContext = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, any, TEvent>,
  options?: MachineOptions<TContext, TEvent>,
  initialContext?: TContext
): StateMachine<TContext, any, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvent>,
  options?: MachineOptions<TContext, TEvent>,
  initialContext?: TContext
): StateMachine<TContext, TStateSchema, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvent>,
  options?: MachineOptions<TContext, TEvent>,
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
  TTypesMeta extends TypegenConstraint = TypegenDisabled,
  TResolvedTypesMeta = ResolveTypegenMeta<TTypesMeta, TEvent, BaseActionObject>
>(
  config: TContext extends Model<any, any, any, any>
    ? 'Model type no longer supported as generic type. Please use `model.createMachine(...)` instead.'
    : MachineConfig<TContext, any, TEvent, BaseActionObject, TTypesMeta>,
  options?: MaybeTypegenMachineOptions<
    TContext,
    TEvent,
    BaseActionObject,
    TResolvedTypesMeta
  >
): StateMachine<
  TContext,
  any,
  TEvent,
  any,
  BaseActionObject,
  TResolvedTypesMeta
>;

export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    any,
    TEvent,
    ActionObject<TContext, TEvent>,
    TTypesMeta
  >,
  options?: MaybeTypegenMachineOptions<
    TContext,
    TEvent,
    BaseActionObject,
    TTypesMeta
  >
): StateMachine<
  TContext,
  any,
  TEvent,
  TTypestate,
  BaseActionObject,
  TTypesMeta
> {
  return new StateNode<TContext, any, TEvent, TTypestate>(
    config,
    options
  ) as StateMachine<
    TContext,
    any,
    TEvent,
    TTypestate,
    BaseActionObject,
    TTypesMeta
  >;
}
