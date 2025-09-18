import { StateMachine } from './StateMachine';
import { enqueueActions } from './actions';
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
  StateNodeConfig,
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
  // because it leaks here, without this condition it manages to create an inferable type that contains it
  // the `silentNeverType` is non-inferable itself and that usually means that a containing object is non-inferable too
  // that doesn't happen here though. However, we actually want to infer a true `never` here so our actions can't use unknown actors
  // for that reason it's important to do the conversion here because we want to map it to something that is actually inferable
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

type SetupReturn<
  TContext extends MachineContext,
  TEvent extends AnyEventObject,
  TActors extends Record<string, UnknownActorLogic>,
  TChildrenMap extends Record<string, string>,
  TActions extends Record<string, ParameterizedObject['params'] | undefined>,
  TGuards extends Record<string, ParameterizedObject['params'] | undefined>,
  TDelay extends string,
  TTag extends string,
  TInput,
  TOutput extends NonReducibleUnknown,
  TEmitted extends EventObject,
  TMeta extends MetaObject
> = {
  extend: <
    TExtendActions extends Record<
      string,
      ParameterizedObject['params'] | undefined
    > = {},
    TExtendGuards extends Record<
      string,
      ParameterizedObject['params'] | undefined
    > = {},
    TExtendDelays extends string = never
  >({
    actions,
    guards,
    delays
  }: {
    actions?: {
      [K in keyof TExtendActions]: ActionFunction<
        TContext,
        TEvent,
        TEvent,
        TExtendActions[K],
        ToProvidedActor<TChildrenMap, TActors>,
        ToParameterizedObject<TActions>,
        ToParameterizedObject<TGuards>,
        TDelay,
        TEmitted
      >;
    };
    guards?: {
      [K in keyof TExtendGuards]: GuardPredicate<
        TContext,
        TEvent,
        TExtendGuards[K],
        ToParameterizedObject<TGuards>
      >;
    };
    delays?: {
      [K in TExtendDelays]: DelayConfig<
        TContext,
        TEvent,
        ToParameterizedObject<TActions>['params'],
        TEvent
      >;
    };
  }) => SetupReturn<
    TContext,
    TEvent,
    TActors,
    TChildrenMap,
    TActions & TExtendActions,
    TGuards & TExtendGuards,
    TDelay | TExtendDelays,
    TTag,
    TInput,
    TOutput,
    TEmitted,
    TMeta
  >;
  /**
   * Creates a state config that is strongly typed. This state config can be
   * used to create a machine.
   *
   * @example
   *
   * ```ts
   * const lightMachineSetup = setup({
   *   // ...
   * });
   *
   * const green = lightMachineSetup.createStateConfig({
   *   on: {
   *     timer: {
   *       actions: 'doSomething'
   *     }
   *   }
   * });
   *
   * const machine = lightMachineSetup.createMachine({
   *   initial: 'green',
   *   states: {
   *     green,
   *     yellow,
   *     red
   *   }
   * });
   * ```
   */
  createStateConfig: <
    TStateConfig extends StateNodeConfig<
      TContext,
      TEvent,
      ToProvidedActor<TChildrenMap, TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TTag,
      unknown,
      TEmitted,
      TMeta
    >
  >(
    config: TStateConfig
  ) => TStateConfig;
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
};

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
}): SetupReturn<
  TContext,
  TEvent,
  TActors,
  TChildrenMap,
  TActions,
  TGuards,
  TDelay,
  TTag,
  TInput,
  TOutput,
  TEmitted,
  TMeta
> {
  return {
    createStateConfig: (config) => config,
    createMachine: (config) =>
      (createMachine as any)(
        { ...config, schemas },
        {
          actors,
          actions,
          guards,
          delays
        }
      ),
    extend: (extended) =>
      setup({
        schemas,
        actors,
        actions: { ...actions, ...extended.actions },
        guards: { ...guards, ...extended.guards },
        delays: { ...delays, ...extended.delays }
      } as any)
  };
}

const s = setup({
  actions: {
    doSomething: () => {},
    other: () => {}
  }
});

s.extend({
  actions: {
    foo: enqueueActions((x) => {
      x.enqueue({
        type: 'doSomething'
      });
    })
  }
}).extend({
  actions: {
    bar: enqueueActions((x) => {
      x.enqueue({
        type: 'foo'
      });
    })
  }
});
