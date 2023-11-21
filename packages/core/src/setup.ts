import {
  ResolveTypegenMeta,
  StateMachine,
  TypegenDisabled,
  createMachine
} from '.';
import { GuardPredicate } from './guards';
import {
  AnyActorLogic,
  MachineContext,
  AnyEventObject,
  NonReducibleUnknown,
  MachineConfig,
  Values,
  ParameterizedObject,
  ActionFunction,
  SetupTypes,
  DelayConfig
} from './types';

type ToParameterizedObject<
  TParameterizedMap extends Record<
    string,
    ParameterizedObject['params'] | undefined
  >
> = Values<{
  [K in keyof TParameterizedMap & string]: {
    type: K;
    params: TParameterizedMap[K];
  };
}>;

type ToProvidedActor<TActors extends Record<string, AnyActorLogic>> = Values<{
  [K in keyof TActors & string]: {
    src: K;
    logic: TActors[K];
  };
}>;

export function setup<
  TContext extends MachineContext,
  TEvent extends AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TActors extends Record<string, AnyActorLogic>,
  TActions extends Record<string, ParameterizedObject['params'] | undefined>,
  TGuards extends Record<string, ParameterizedObject['params'] | undefined>,
  TDelay extends string,
  TTag extends string,
  TInput,
  TOutput extends NonReducibleUnknown
>({
  actors,
  actions,
  guards,
  delays
}: {
  types?: SetupTypes<TContext, TEvent, TTag, TInput, TOutput>;

  actors?: TActors;
  actions?: {
    [K in keyof TActions]: ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TActions[K],
      ToProvidedActor<TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay
    >;
  };
  guards?: {
    [K in keyof TGuards]: GuardPredicate<
      TContext,
      TEvent,
      TGuards[K],
      ToParameterizedObject<TGuards>
    >;
  };
  delays?: {
    [K in TDelay]: DelayConfig<
      TContext,
      TEvent,
      ToParameterizedObject<TActions>['params'],
      TEvent
    >;
  };
}): {
  createMachine: (
    config: MachineConfig<
      TContext,
      TEvent,
      ToProvidedActor<TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TTag,
      TInput,
      TOutput,
      ResolveTypegenMeta<
        TypegenDisabled,
        TEvent,
        ToProvidedActor<TActors>,
        ToParameterizedObject<TActions>,
        ToParameterizedObject<TGuards>,
        TDelay,
        TTag
      >
    >
  ) => StateMachine<
    TContext,
    TEvent,
    ToProvidedActor<TActors>,
    ToParameterizedObject<TActions>,
    ToParameterizedObject<TGuards>,
    TDelay,
    TTag,
    TInput,
    TOutput,
    ResolveTypegenMeta<
      TypegenDisabled,
      TEvent,
      ToProvidedActor<TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TTag
    >
  >;
} {
  return {
    createMachine: (config) =>
      createMachine(config, {
        actors,
        actions,
        guards,
        delays
      } as any)
  };
}
