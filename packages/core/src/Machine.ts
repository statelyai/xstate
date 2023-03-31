import {
  MachineConfig,
  EventObject,
  AnyEventObject,
  MachineContext,
  ActorMap,
  InternalMachineImplementations,
  ParameterizedObject
} from './types.js';
import {
  TypegenConstraint,
  TypegenDisabled,
  ResolveTypegenMeta
} from './typegenTypes.js';
import { StateMachine } from './StateMachine.js';

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
    config,
    implementations as any
  );
}
