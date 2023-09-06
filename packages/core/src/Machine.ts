import {
  MachineConfig,
  EventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  AnyEventObject,
  NonReducibleUnknown,
  Prop,
  MetaObject
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
  TStateMeta extends MetaObject = MetaObject,
  TTransitionMeta extends MetaObject = MetaObject,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
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
    TStateMeta,
    TTransitionMeta,
    TTypesMeta
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
  TStateMeta,
  TTransitionMeta,
  ResolveTypegenMeta<TTypesMeta, TEvent, TActor, TAction, TGuard, TDelay, TTag>
> {
  return new StateMachine<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any, // TStateMeta
    any // TTransitionMeta
  >(config as any, implementations as any);
}
