import { StateMachine } from './StateMachine.ts';
import { ResolveTypegenMeta, TypegenConstraint } from './typegenTypes.ts';
import {
  AnyEventObject,
  InternalMachineImplementations,
  MachineConfig,
  MachineContext,
  NonReducibleUnknown,
  ParameterizedObject,
  Prop,
  ProvidedActor
} from './types.ts';

export function createMachine<
  const TConfig extends MachineConfig<
    TContext,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TTag,
    TInput,
    TOutput
  >,
  TContext extends MachineContext = TConfig extends { types: { context: MachineContext} } ? TConfig["types"]["context"] : MachineContext,
  TEvent extends AnyEventObject = TConfig extends { types: { events: AnyEventObject} } ? TConfig["types"]["events"] : AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TActor extends ProvidedActor  = TConfig extends { types: { actors: ProvidedActor} } ? TConfig["types"]["actors"] : ProvidedActor,
  TAction extends ParameterizedObject  = TConfig extends { types: { actions: ParameterizedObject} } ? TConfig["types"]["actions"] : ParameterizedObject,
  TGuard extends ParameterizedObject= TConfig extends { types: { guards: ParameterizedObject} } ? TConfig["types"]["guards"] : ParameterizedObject,
  TDelay extends string= TConfig extends { types: { delays: string} } ? TConfig["types"]["delays"] : string,
  TTag extends string= TConfig extends { types: { tags: string} } ? TConfig["types"]["tags"] : string,
  TInput = TConfig extends { types: { input: unknown} } ? TConfig["types"]["input"] : unknown,
  TOutput extends NonReducibleUnknown = TConfig extends { types: { output: NonReducibleUnknown} } ? TConfig["types"]["output"] : NonReducibleUnknown,
  TTypesMeta extends TypegenConstraint = TConfig extends { types: { typegen: TypegenConstraint} } ? TConfig["types"]["typegen"] : TypegenConstraint,
>(
  config:
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
