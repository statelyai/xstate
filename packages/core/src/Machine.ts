import {
  MachineConfig,
  EventObject,
  AnyEventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ActorImpl
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
  TActors extends ActorImpl = ActorImpl,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActors,
    TTypesMeta
  >,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    ParameterizedObject,
    TActors,
    ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActors>
  >
): StateMachine<
  TContext,
  TEvent,
  ParameterizedObject,
  TActors,
  ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActors>
> {
  return new StateMachine<any, any, any, any, any>(
    config,
    implementations as any
  );
}
