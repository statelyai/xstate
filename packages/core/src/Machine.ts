import {
  MachineConfig,
  EventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  AnyEventObject
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
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActor,
    TInput,
    TTypesMeta
  >,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    ParameterizedObject,
    TActor,
    ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActor>
  >
): StateMachine<
  TContext,
  TEvent,
  ParameterizedObject,
  TActor,
  TInput,
  ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActor>
> {
  return new StateMachine<any, any, any, any, any, any>(
    config as any,
    implementations as any
  );
}
