import {
  MachineConfig,
  EventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  AnyEventObject,
  NonReducibleUnknown
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
  TOutput = NonReducibleUnknown,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    TEvent,
    TAction,
    TGuard,
    TActor,
    TInput,
    TOutput,
    TTypesMeta
  >,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    TAction,
    TActor,
    ResolveTypegenMeta<TTypesMeta, TEvent, TAction, TActor>
  >
): StateMachine<
  TContext,
  TEvent,
  TAction,
  TGuard,
  TActor,
  TInput,
  TOutput,
  ResolveTypegenMeta<TTypesMeta, TEvent, TAction, TActor>
> {
  return new StateMachine<any, any, any, any, any, any, any, any>(
    config as any,
    implementations as any
  );
}
