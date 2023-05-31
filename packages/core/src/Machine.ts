import {
  MachineConfig,
  EventObject,
  AnyEventObject,
  MachineContext,
  ActorMap,
  InternalMachineImplementations,
  ParameterizedObject
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
  TActorMap extends ActorMap = ActorMap,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActorMap,
    TTypesMeta
  >,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActorMap>
  >
): StateMachine<
  TContext,
  TEvent,
  ParameterizedObject,
  TActorMap,
  ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActorMap>
> {
  return new StateMachine<any, any, any, any, any>(
    config as any,
    implementations as any
  );
}
