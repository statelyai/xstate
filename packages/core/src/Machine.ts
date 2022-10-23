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
import { CreateMachineTypes } from './createTypes';

export function createMachine2<TT extends CreateMachineTypes<any>>(
  config: MachineConfig<
    TT['context'],
    TT['events'] & EventObject,
    BaseActionObject,
    any,
    any,
    TT
  >
): StateMachine<
  TT['context'],
  TT['events'] & EventObject,
  BaseActionObject,
  any,
  any,
  TT
> {
  return new StateMachine(config) as any;
}

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
