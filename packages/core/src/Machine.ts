import {
  MachineConfig,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  NonReducibleUnknown,
  Prop,
  AnyEventObject
} from './types.ts';
import { TypegenConstraint, ResolveTypegenMeta } from './typegenTypes.ts';
import { StateMachine } from './StateMachine.ts';

interface StatesSchema {
  states?: Record<string, StatesSchema>;
  [k: string]: unknown;
}

export function createMachine<
  TContext extends MachineContext,
  TEvent extends AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TInput,
  TOutput extends NonReducibleUnknown,
  TTypesMeta extends TypegenConstraint,
  TConfig extends StatesSchema
>(
  config: MachineConfig<
    TContext,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TTag,
    TInput,
    TOutput,
    TTypesMeta
  > &
    TConfig,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    TActor,
    TAction,
    TDelay,
    ResolveTypegenMeta<
      TTypesMeta,
      TEvent,
      TActor,
      TAction,
      TGuard,
      TDelay,
      TTag
    >
  >
): StateMachine<
  TContext,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TDelay,
  Prop<
    ResolveTypegenMeta<
      TTypesMeta,
      TEvent,
      TActor,
      TAction,
      TGuard,
      TDelay,
      TTag
    >['resolved'],
    'tags'
  > &
    string,
  TInput,
  TOutput,
  ResolveTypegenMeta<TTypesMeta, TEvent, TActor, TAction, TGuard, TDelay, TTag>
> {
  return new StateMachine<any, any, any, any, any, any, any, any, any, any>(
    config as any,
    implementations as any
  );
}
