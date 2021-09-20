import {
  ActionObject,
  ActionFunction,
  Cast,
  ConditionPredicate,
  BaseActionObject,
  DelayConfig,
  EventObject,
  InvokeCreator,
  IndexByType,
  IsNever,
  MachineOptions,
  Values
} from './types';

export interface TypegenDisabled {
  '@@xstate/typegen': false;
}
export interface TypegenEnabled {
  '@@xstate/typegen': true;
}
export interface TypegenMeta extends TypegenEnabled {
  matchesStates: string;
  tags: string;
  missingImplementations: {
    actions: string;
    delays: string;
    guards: string;
    services: string;
  };
  eventsCausingActions: Record<string, string>;
  eventsCausingDelays: Record<string, string>;
  eventsCausingGuards: Record<string, string>;
  eventsCausingServices: Record<string, string>;
}

export interface ResolvedTypegenMeta extends TypegenMeta {
  indexedActions: Record<string, BaseActionObject>;
  indexedEvents: Record<string, EventObject>;
}

export type TypegenConstraint = TypegenMeta | TypegenDisabled;

// if combined union of all missing implementation types is never then everything has been provided
export type AreAllImplementationsAssumedToBeProvided<
  TResolvedTypesMeta
> = TResolvedTypesMeta extends TypegenEnabled
  ? IsNever<
      Values<
        {
          // @ts-ignore
          [K in keyof TResolvedTypesMeta['missingImplementations']]: TResolvedTypesMeta['missingImplementations'][K];
        }
      >
    > extends true
    ? true
    : false
  : true;

export type MarkAllImplementationsAsProvided<
  TResolvedTypesMeta
> = TResolvedTypesMeta & {
  missingImplementations: {
    actions: never;
    delays: never;
    guards: never;
    services: never;
  };
};

export type ResolveTypegenMeta<
  TTypesMeta extends TypegenConstraint,
  TEvent extends EventObject,
  TAction extends BaseActionObject
> = TTypesMeta extends TypegenEnabled
  ? TTypesMeta & {
      indexedActions: IndexByType<TAction>;
      indexedEvents: IndexByType<TEvent>;
    }
  : TypegenDisabled;

export type TypegenMachineOptionsActions<
  TContext,
  TResolvedTypesMeta,
  // @ts-ignore
  TEventsCausingActions = TResolvedTypesMeta['eventsCausingActions'],
  // @ts-ignore
  TIndexedEvents = TResolvedTypesMeta['indexedEvents'],
  // @ts-ignore
  TIndexedActions = TResolvedTypesMeta['indexedActions']
> = {
  [K in keyof TEventsCausingActions]?:
    | ActionObject<
        TContext,
        // @ts-ignore
        TIndexedEvents[TEventsCausingActions[K]]
      >
    | ActionFunction<
        TContext,
        // @ts-ignore
        TIndexedEvents[TEventsCausingActions[K]],
        // @ts-ignore
        TIndexedActions[K]
      >;
};

export type TypegenMachineOptionsDelays<
  TContext,
  TResolvedTypesMeta,
  // @ts-ignore
  TEventsCausingDelays = TResolvedTypesMeta['eventsCausingDelays'],
  // @ts-ignore
  TIndexedEvents = TResolvedTypesMeta['indexedEvents']
> = {
  [K in keyof TEventsCausingDelays]?: DelayConfig<
    TContext,
    // @ts-ignore
    TIndexedEvents[TEventsCausingDelays[K]]
  >;
};

export type TypegenMachineOptionsGuards<
  TContext,
  TResolvedTypesMeta,
  // @ts-ignore
  TEventsCausingGuards = TResolvedTypesMeta['eventsCausingGuards'],
  // @ts-ignore
  TIndexedEvents = TResolvedTypesMeta['indexedEvents']
> = {
  [K in keyof TEventsCausingGuards]?: ConditionPredicate<
    TContext,
    // @ts-ignore
    TIndexedEvents[TEventsCausingGuards[K]]
  >;
};

export type TypegenMachineOptionsServices<
  TContext,
  TResolvedTypesMeta,
  // @ts-ignore
  TEventsCausingServices = TResolvedTypesMeta['eventsCausingServices'],
  // @ts-ignore
  TIndexedEvents = TResolvedTypesMeta['indexedEvents']
> = {
  [K in keyof TEventsCausingServices]?: InvokeCreator<
    TContext,
    // @ts-ignore
    TIndexedEvents[TEventsCausingServices[K]]
  >;
};

type MakeKeysRequired<T extends string> = { [K in T]: unknown };

type MaybeMakeMissingImplementationsRequired<
  TImplementationType,
  TMissingImplementations,
  TRequireMissingImplementations
> = TRequireMissingImplementations extends true
  ? IsNever<TMissingImplementations> extends true
    ? {}
    : {
        [K in Cast<TImplementationType, string>]: MakeKeysRequired<// @ts-ignore
        TMissingImplementations>;
      }
  : {};

type GenerateActionsConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  // @ts-ignore
  TMissingActions = TResolvedTypesMeta['missingImplementations']['actions']
> = MaybeMakeMissingImplementationsRequired<
  'actions',
  TMissingActions,
  TRequireMissingImplementations
> & {
  actions?: TypegenMachineOptionsActions<TContext, TResolvedTypesMeta>;
};

type GenerateDelaysConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  // @ts-ignore
  TMissingDelays = TResolvedTypesMeta['missingImplementations']['delays']
> = MaybeMakeMissingImplementationsRequired<
  'delays',
  TMissingDelays,
  TRequireMissingImplementations
> & {
  delays?: TypegenMachineOptionsDelays<TContext, TResolvedTypesMeta>;
};

type GenerateGuardsConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  // @ts-ignore
  TMissingGuards = TResolvedTypesMeta['missingImplementations']['guards']
> = MaybeMakeMissingImplementationsRequired<
  'guards',
  TMissingGuards,
  TRequireMissingImplementations
> & {
  guards?: TypegenMachineOptionsGuards<TContext, TResolvedTypesMeta>;
};

type GenerateServicesConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  // @ts-ignore
  TMissingServices = TResolvedTypesMeta['missingImplementations']['services']
> = MaybeMakeMissingImplementationsRequired<
  'services',
  TMissingServices,
  TRequireMissingImplementations
> & {
  services?: TypegenMachineOptionsServices<TContext, TResolvedTypesMeta>;
};

export type TypegenMachineOptions<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations
> = GenerateActionsConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations
> &
  GenerateDelaysConfigPart<
    TContext,
    TResolvedTypesMeta,
    TRequireMissingImplementations
  > &
  GenerateGuardsConfigPart<
    TContext,
    TResolvedTypesMeta,
    TRequireMissingImplementations
  > &
  GenerateServicesConfigPart<
    TContext,
    TResolvedTypesMeta,
    TRequireMissingImplementations
  >;

export type MaybeTypegenMachineOptions<
  TContext,
  TEvent extends EventObject,
  TAction extends BaseActionObject = BaseActionObject,
  TResolvedTypesMeta = TypegenDisabled,
  TRequireMissingImplementations extends boolean = false
> = TResolvedTypesMeta extends TypegenEnabled
  ? TypegenMachineOptions<
      TContext,
      TResolvedTypesMeta,
      TRequireMissingImplementations
    >
  : MachineOptions<TContext, TEvent, TAction>;
