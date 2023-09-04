import {
  MachineConfig,
  EventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  AnyEventObject,
  NonReducibleUnknown,
  Prop
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
  TDelay extends string = string,
  TTag extends string = string,
  TInput = any,
  TOutput = NonReducibleUnknown,
  TTypesMeta extends TypegenConstraint = TypegenDisabled,
  TStateKey extends string = string
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
    TTypesMeta,
    TStateKey
  >,
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
> & { _state: TStateKey } {
  return new StateMachine<any, any, any, any, any, any, any, any, any, any>(
    config as any,
    implementations as any
  ) as any;
}
