import {
  MachineConfig,
  EventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  AnyEventObject,
  MachineStates
} from './types.ts';
import {
  TypegenConstraint,
  TypegenDisabled,
  ResolveTypegenMeta
} from './typegenTypes.ts';
import { StateMachine } from './StateMachine.ts';

export interface StatesConfig {
  states?: {
    [key: string]: StatesConfig;
  };
}

export function createMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject,
  TActor extends ProvidedActor = ProvidedActor,
  TInput = any,
  TTypesMeta extends TypegenConstraint = TypegenDisabled,
  Literal extends string = string,
  TStates extends MachineStates<Literal> = MachineStates<Literal>
>(
  config: MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActor,
    TInput,
    TTypesMeta
  > &
    TStates,
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
  ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActor>,
  TStates
> {
  return new StateMachine(config as any, implementations as any);
}
