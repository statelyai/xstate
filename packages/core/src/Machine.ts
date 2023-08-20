import {
  MachineConfig,
  EventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  AnyEventObject,
  StateValue
} from './types.ts';
import {
  TypegenConstraint,
  TypegenDisabled,
  ResolveTypegenMeta
} from './typegenTypes.ts';
import { StateMachine } from './StateMachine.ts';

export function createMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject,
  TActor extends ProvidedActor = ProvidedActor,
  TInput = any,
  TOutput = any,
  TActions extends ParameterizedObject = ParameterizedObject,
  TGuards extends ParameterizedObject = ParameterizedObject,
  TDelays extends string = string,
  TTags extends string = string,
  TTypestates extends { value: StateValue; context: TContext } = any,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    TEvent,
    TActions,
    TActor,
    TInput,
    TOutput,
    TGuards,
    TDelays,
    TTags,
    TTypestates,
    TTypesMeta
  >,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    TActions,
    TActor,
    TGuards,
    TDelays,
    // No implementation for tags
    // No implementations for typestates
    ResolveTypegenMeta<TTypesMeta, TEvent, TActions, TActor>
  >
): StateMachine<
  TContext,
  TEvent,
  TActions,
  TActor,
  TInput,
  TOutput,
  TGuards,
  TDelays,
  TTags,
  TTypestates,
  ResolveTypegenMeta<TTypesMeta, TEvent, TActions, TActor>
> {
  return new StateMachine<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >(config as any, implementations as any);
}
