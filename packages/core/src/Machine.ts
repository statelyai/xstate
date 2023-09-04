import {
  MachineConfig,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  NonReducibleUnknown,
  Prop,
  AnyEventObject,
  MachineTypesConstraint,
  ResolveTypes,
  Cast
} from './types.ts';
import { TypegenConstraint, ResolveTypegenMeta } from './typegenTypes.ts';
import { StateMachine } from './StateMachine.ts';

type GetContext<T> = Cast<Prop<Prop<T, 'types'>, 'context'>, MachineContext>;
type GetEvent<T> = Cast<Prop<Prop<T, 'types'>, 'events'>, AnyEventObject>;
type GetActor<T> = Cast<Prop<Prop<T, 'types'>, 'actors'>, ProvidedActor>;
type GetAction<T> = Cast<
  Prop<Prop<T, 'types'>, 'actions'>,
  ParameterizedObject
>;
type GetGuard<T> = Cast<Prop<Prop<T, 'types'>, 'guards'>, ParameterizedObject>;
type GetDelay<T> = Cast<Prop<Prop<T, 'types'>, 'delays'>, string>;
type GetTag<T> = Cast<Prop<Prop<T, 'types'>, 'tags'>, string>;
type GetInput<T> = Cast<Prop<Prop<T, 'types'>, 'input'>, NonReducibleUnknown>;
type GetOutput<T> = Cast<Prop<Prop<T, 'types'>, 'output'>, NonReducibleUnknown>;
type GetTypegen<T> = Cast<Prop<Prop<T, 'types'>, 'typegen'>, TypegenConstraint>;

export function createMachine<
  TConfig extends MachineConfig<
    GetContext<TConfig>,
    GetEvent<TConfig>,
    GetActor<TConfig>,
    GetAction<TConfig>,
    GetGuard<TConfig>,
    GetDelay<TConfig>,
    GetTag<TConfig>,
    GetInput<TConfig>,
    GetOutput<TConfig>,
    GetTypegen<TConfig>
  >
>(
  config: TConfig
  // implementations?: InternalMachineImplementations<
  //   ResolveTypes<TConfig["types"] & MachineTypesConstraint>["context"],
  //   TEvent,
  //   TActor,
  //   TAction,
  //   TDelay,
  //   ResolveTypegenMeta<
  //     TTypesMeta,
  //     TEvent,
  //     TActor,
  //     TAction,
  //     TGuard,
  //     TDelay,
  //     TTag
  //   >
  // >
): { TContext: GetContext<TConfig>; TConfig: TConfig } & //     string, //   > & //     'tags' //     >['resolved'], //       TTag //       TDelay, //       TGuard, //       TAction, //       TActor, //       TEvent, //       TTypesMeta, //     ResolveTypegenMeta< //   Prop< //   TDelay, //   TGuard, //   TAction, //   TActor, //   TEvent, //   TContext, // StateMachine<
//   TInput,
//   TOutput,
//   ResolveTypegenMeta<TTypesMeta, TEvent, TActor, TAction, TGuard, TDelay, TTag>
// >

{
  TConfig: TConfig;
} {
  return new StateMachine<any, any, any, any, any, any, any, any, any, any>(
    config as any,
    implementations as any
  );
}
