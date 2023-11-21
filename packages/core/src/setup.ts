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
  DelayConfig,
  Invert,
  IsNever
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

// TODO: explain this
type DefaultToAnyActors<TActors extends Record<string, AnyActorLogic>> =
  IsNever<keyof TActors> extends true ? Record<string, AnyActorLogic> : TActors;

// TODO: this doesn't quite restrict it to only known keys, should it?
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
  createMachine: (
    config: MachineConfig<
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
  ) => StateMachine<
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
