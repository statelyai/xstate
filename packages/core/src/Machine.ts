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
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TInput = any,
  TOutput = NonReducibleUnknown,
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
    TActor,
    TAction,
    ResolveTypegenMeta<TTypesMeta, TEvent, TActor, TAction>
  >
): StateMachine<
  TContext,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TInput,
  TOutput,
  ResolveTypegenMeta<TTypesMeta, TEvent, TActor, TAction>
> {
  return new StateMachine<any, any, any, any, any, any, any, any>(
    config as any,
    implementations as any
  );
}
