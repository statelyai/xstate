import { StateMachine } from './StateMachine';
import { createMachine } from './createMachine';
import { GuardPredicate } from './guards';

import {
  ActionFunction,
  AnyActorRef,
  AnyEventObject,
  Cast,
  DelayConfig,
  EventObject,
  Invert,
  IsNever,
  MachineConfig,
  MachineContext,
  MetaObject,
  NonReducibleUnknown,
  ParameterizedObject,
  SetupTypes,
  ToChildren,
  ToStateValue,
  UnknownActorLogic,
  Values
} from './types';

type ToParameterizedObject<
  TParameterizedMap extends Record<
    string,
    ParameterizedObject['params'] | undefined
  >
> = // `silentNeverType` to `never` conversion (explained in `ToProvidedActor`)
  IsNever<TParameterizedMap> extends true
    ? never
    : Values<{
        [K in keyof TParameterizedMap & string]: {
          type: K;
          params: TParameterizedMap[K];
        };
      }>;

// at the moment we allow extra actors - ones that are not specified by `children`
// this could be reconsidered in the future
type ToProvidedActor<
  TChildrenMap extends Record<string, string>,
  TActors extends Record<string, UnknownActorLogic>
> =
  // this essentially is meant to convert a leaked `silentNeverType` to the true `never` type
  // it shouldn't be observable but here we are
  // we don't want to lock inner inferences for our actions with types containing this type
  // it's used in inner inference contexts when the outer one context doesn't have inference candidates for a type parameter
  // because it leaks here, without this condition it manages to create an inferrable type that contains it
  // the `silentNeverType` is non-inferrable itself and that usually means that a containing object is non-inferrable too
  // that doesn't happen here though. However, we actually want to infer a true `never` here so our actions can't use unknown actors
  // for that reason it's important to do the conversion here because we want to map it to something that is actually inferrable
  IsNever<TActors> extends true
    ? never
    : Values<{
        [K in keyof TActors & string]: {
          src: K;
          logic: TActors[K];
          id: IsNever<TChildrenMap> extends true
            ? string | undefined
            : K extends keyof Invert<TChildrenMap>
              ? Invert<TChildrenMap>[K] & string
              : string | undefined;
        };
      }>;

type RequiredSetupKeys<TChildrenMap> =
  IsNever<keyof TChildrenMap> extends true ? never : 'actors';

export function setup<
  TContext extends MachineContext,
  TEvent extends AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TActors extends Record<string, UnknownActorLogic> = {},
  TChildrenMap extends Record<string, string> = {},
  TActions extends Record<
    string,
    ParameterizedObject['params'] | undefined
  > = {},
  TGuards extends Record<
    string,
    ParameterizedObject['params'] | undefined
  > = {},
  TDelay extends string = never,
  TTag extends string = string,
  TInput = NonReducibleUnknown,
  TOutput extends NonReducibleUnknown = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject,
  TMeta extends MetaObject = MetaObject
>({
  schemas,
  actors,
  actions,
  guards,
  delays
}: {
  schemas?: unknown;
  types?: SetupTypes<
    TContext,
    TEvent,
    TChildrenMap,
    TTag,
    TInput,
    TOutput,
    TEmitted,
    TMeta
  >;
  actors?: {
    // union here enforces that all configured children have to be provided in actors
    // it makes those values required here
    [K in keyof TActors | Values<TChildrenMap>]: K extends keyof TActors
      ? TActors[K]
      : never;
  };
  actions?: {
    [K in keyof TActions]: ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TActions[K],
      ToProvidedActor<TChildrenMap, TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TEmitted
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
} & {
  [K in RequiredSetupKeys<TChildrenMap>]: unknown;
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
      TEmitted,
      TMeta
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
    TEmitted,
    TMeta,
    TConfig
  >;
} {
  return {
    createMachine: (config) =>
      (createMachine as any)(
        { ...config, schemas },
        {
          actors,
          actions,
          guards,
          delays
        }
      )
  };
}
