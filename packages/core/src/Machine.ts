import {
  MachineConfig,
  EventObject,
  AnyEventObject,
  MachineContext,
  ActorMap,
  InternalMachineImplementations,
  BaseActionObject
} from './types';
import {
  TypegenConstraint,
  TypegenDisabled,
  ResolveTypegenMeta
} from './typegenTypes';
import { StateMachine } from './StateMachine';

export function createMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject,
  TActorMap extends ActorMap = ActorMap,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    TEvent,
    BaseActionObject,
    TActorMap,
    TTypesMeta
  >,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    ResolveTypegenMeta<TTypesMeta, TEvent, BaseActionObject, TActorMap>
  >
): StateMachine<
  TContext,
  TEvent,
  BaseActionObject,
  TActorMap,
  ResolveTypegenMeta<TTypesMeta, TEvent, BaseActionObject, TActorMap>
> {
  return new StateMachine<any, any, any, any, any>(
    config,
    implementations as any
  );
}
