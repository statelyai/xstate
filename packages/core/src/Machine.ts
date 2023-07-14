import {
  MachineConfig,
  EventObject,
  AnyEventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor
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
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActor,
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
  ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActor>
> {
  return new StateMachine<any, any, any, any, any>(
    config,
    implementations as any
  );
}
