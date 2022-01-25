import { Model } from './model.types';
import { StateNode } from './StateNode';
import {
  AnyEventObject,
  BaseActionObject,
  DefaultContext,
  EventObject,
  MachineConfig,
  MachineOptions,
  InternalMachineOptions,
  StateMachine,
  StateSchema,
  Typestate,
  MachineSchema,
  ResolveTypeContainer
} from './types';
import { TypegenConstraint, TypegenDisabled } from './typegenTypes';

/**
 * @deprecated Use `createMachine(...)` instead.
 */
export function Machine<
  TContext = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, any, TEvent>,
  options?: InternalMachineOptions<
    ResolveTypeContainer<
      TContext,
      MachineSchema<TContext, TEvent>,
      TypegenDisabled
    >
  >,
  initialContext?: TContext
): StateMachine<
  TContext,
  any,
  TEvent,
  any,
  ResolveTypeContainer<
    TContext,
    MachineSchema<TContext, TEvent>,
    TypegenDisabled
  >
>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvent>,
  options?: InternalMachineOptions<
    ResolveTypeContainer<
      TContext,
      MachineSchema<TContext, TEvent>,
      TypegenDisabled
    >
  >,
  initialContext?: TContext
): StateMachine<
  TContext,
  TStateSchema,
  TEvent,
  any,
  ResolveTypeContainer<
    TContext,
    MachineSchema<TContext, TEvent>,
    TypegenDisabled
  >
>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, TStateSchema, TEvent>,
  options?: MachineOptions<TContext, TEvent>,
  initialContext: TContext | (() => TContext) | undefined = config.context
): any {
  return new StateNode<TContext, TStateSchema, TEvent>(
    config,
    options,
    initialContext
  ) as any;
}

export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TSchema extends MachineSchema<any, any> = MachineSchema<TContext, TEvent>,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: TContext extends Model<any, any, any, any>
    ? 'Model type no longer supported as generic type. Please use `model.createMachine(...)` instead.'
    : MachineConfig<
        TContext,
        any,
        TEvent,
        BaseActionObject,
        TSchema,
        TTypesMeta
      >,
  options?: InternalMachineOptions<
    ResolveTypeContainer<TContext, TSchema, TTypesMeta>
  >
): StateMachine<
  TContext,
  any,
  TEvent,
  any,
  ResolveTypeContainer<TContext, TSchema, TTypesMeta>
>;

export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TSchema extends MachineSchema<any, any> = MachineSchema<TContext, TEvent>,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    any,
    TEvent,
    BaseActionObject,
    TSchema,
    TTypesMeta
  >,
  options?: MachineOptions<TContext, TEvent, BaseActionObject, TTypesMeta>
): StateMachine<
  TContext,
  any,
  TEvent,
  TTypestate,
  ResolveTypeContainer<TContext, TSchema, TTypesMeta>
> {
  return new StateNode(config, options as any) as any;
}
