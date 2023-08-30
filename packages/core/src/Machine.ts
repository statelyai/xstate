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
  ResolveTypes
} from './types.ts';
import { TypegenConstraint, ResolveTypegenMeta } from './typegenTypes.ts';
import { StateMachine } from './StateMachine.ts';

type GetTypes<TConfig> = 'types' extends keyof TConfig
  ? TConfig['types']
  : never;

// export function createMachine<TConfig extends MachineConfig<GetTypes<TConfig>>>(
// @ts-expect-error
export function createMachine<TConfig extends MachineConfig<TConfig['types']>>(
  config: TConfig
  implementations?: InternalMachineImplementations<
    ResolveTypes<TConfig["types"] & MachineTypesConstraint>["context"],
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
): { TTypes: ResolveTypes<TConfig['types']> } & //       TTypesMeta, //     ResolveTypegenMeta< //   Prop< //   TDelay, //   TGuard, //   TAction, //   TActor, //   TEvent, //   TContext, // StateMachine<
//       TEvent,
//       TActor,
//       TAction,
//       TGuard,
//       TDelay,
//       TTag
//     >['resolved'],
//     'tags'
//   > &
//     string,
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
