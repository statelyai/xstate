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
  ConditionalRequired,
  DelayConfig,
  Invert,
  IsNever,
  MachineConfig,
  MachineContext,
  NonReducibleUnknown,
  ParameterizedObject,
  SetupTypes,
  StateSchema,
  ToChildren,
  UnknownActorLogic,
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
  TActors extends Record<Values<TChildrenMap>, AnyActorLogic>,
  TResolvedActors extends Record<
    string,
    AnyActorLogic
  > = DefaultToAnyActors<TActors>
> = Values<{
  [K in keyof TResolvedActors & string]: {
    src: K;
    logic: TResolvedActors[K];
    id: IsNever<TChildrenMap> extends true
      ? string | undefined
      : K extends keyof Invert<TChildrenMap>
        ? Invert<TChildrenMap>[K]
        : string | undefined;
  };
}>;

type _GroupStateKeys<
  T extends StateSchema,
  S extends keyof T['states']
> = S extends any
  ? T['states'][S] extends { type: 'history' }
    ? [never, never]
    : T extends { type: 'parallel' }
      ? [S, never]
      : 'states' extends keyof T['states'][S]
        ? [S, never]
        : [never, S]
  : never;

type GroupStateKeys<T extends StateSchema, S extends keyof T['states']> = {
  nonLeaf: _GroupStateKeys<T, S & string>[0];
  leaf: _GroupStateKeys<T, S & string>[1];
};

type ToStateValue<T extends StateSchema> = T extends {
  states: Record<infer S, any>;
}
  ? IsNever<S> extends true
    ? {}
    :
        | GroupStateKeys<T, S>['leaf']
        | (IsNever<GroupStateKeys<T, S>['nonLeaf']> extends false
            ? ConditionalRequired<
                {
                  [K in GroupStateKeys<T, S>['nonLeaf']]?: ToStateValue<
                    T['states'][K]
                  >;
                },
                T extends { type: 'parallel' } ? true : false
              >
            : never)
  : {};

export function setup<
  TContext extends MachineContext,
  TEvent extends AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TActors extends Record<Values<TChildrenMap>, UnknownActorLogic>,
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
    ToStateValue<TConfig>,
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
