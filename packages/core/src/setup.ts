import { StateMachine } from './StateMachine';
import { createMachine } from './createMachine';
import { GuardPredicate } from './guards';
import { ResolveTypegenMeta, TypegenDisabled } from './typegenTypes';
import {
  ActionFunction,
  AnyActorLogic,
  AnyActorRef,
  AnyEventObject,
  Cast,
  DelayConfig,
  Invert,
  IsNever,
  MachineConfig,
  MachineContext,
  NonReducibleUnknown,
  ParameterizedObject,
  SetupTypes,
  ToChildren,
  Values
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

type DefaultToAnyActors<TActors extends Record<string, AnyActorLogic>> =
  // if `keyof TActors` is `never` then it means that both `children` and `actors` were not supplied
  // `never` comes from the default type of the `TChildrenMap` type parameter
  // in such a case we "replace" `TActors` with a more traditional~ constraint
  // one that doesn't depend on `Values<TChildrenMap>`
  IsNever<keyof TActors> extends true ? Record<string, AnyActorLogic> : TActors;

// at the moment we allow extra actors - ones that are not specified by `children`
// this could be reconsidered in the future
type ToProvidedActor<
  TChildrenMap extends Record<string, string>,
  TActors extends Record<Values<TChildrenMap>, AnyActorLogic>
> = Values<{
  [K in keyof DefaultToAnyActors<TActors> & string]: {
    src: K;
    logic: TActors[K];
    id: IsNever<TChildrenMap> extends true
      ? string | undefined
      : K extends keyof Invert<TChildrenMap>
        ? Invert<TChildrenMap>[K]
        : string | undefined;
  };
}>;

export function setup<
  TContext extends MachineContext,
  TEvent extends AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TActors extends Record<Values<TChildrenMap>, AnyActorLogic>,
  TActions extends Record<string, ParameterizedObject['params'] | undefined>,
  TGuards extends Record<string, ParameterizedObject['params'] | undefined>,
  TDelay extends string,
  TTag extends string,
  TInput,
  TOutput extends NonReducibleUnknown,
  TChildrenMap extends Record<string, string> = never
>({
  actors,
  actions,
  guards,
  delays
}: {
  types?: SetupTypes<TContext, TEvent, TChildrenMap, TTag, TInput, TOutput>;
  actors?: TActors;
  actions?: {
    [K in keyof TActions]: ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TActions[K],
      ToProvidedActor<TChildrenMap, TActors>,
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
  createMachine: <
    const TConfig extends MachineConfig<
      TContext,
      TEvent,
      ToProvidedActor<TChildrenMap, TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TTag,
      TInput,
      TOutput,
      ResolveTypegenMeta<
        TypegenDisabled,
        TEvent,
        ToProvidedActor<TChildrenMap, TActors>,
        ToParameterizedObject<TActions>,
        ToParameterizedObject<TGuards>,
        TDelay,
        TTag
      >
    >
  >(
    config: TConfig
  ) => StateMachine<
    TContext,
    TEvent,
    Cast<
      ToChildren<ToProvidedActor<TChildrenMap, TActors>>,
      Record<string, AnyActorRef | undefined>
    >,
    ToProvidedActor<TChildrenMap, TActors>,
    ToParameterizedObject<TActions>,
    ToParameterizedObject<TGuards>,
    TDelay,
    TTag,
    TInput,
    TOutput,
    ResolveTypegenMeta<
      TypegenDisabled,
      TEvent,
      ToProvidedActor<TChildrenMap, TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TTag
    >
  >;
} {
  return {
    createMachine: (config) =>
      (createMachine as any)(config, {
        actors,
        actions,
        guards,
        delays
      })
  };
}
