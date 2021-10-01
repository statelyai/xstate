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
  Prop,
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
  internalEvents: {};
  eventsCausingActions: Record<string, string>;
  eventsCausingDelays: Record<string, string>;
  eventsCausingGuards: Record<string, string>;
  eventsCausingServices: Record<string, string>;
}

export interface ResolvedTypegenMeta extends TypegenMeta {
  indexedActions: Record<string, BaseActionObject>;
  indexedEvents: Record<string, EventObject>;
}

export type TypegenConstraint = TypegenEnabled | TypegenDisabled;

// if combined union of all missing implementation types is never then everything has been provided
export type AreAllImplementationsAssumedToBeProvided<
  TResolvedTypesMeta,
  TMissingImplementations = Prop<TResolvedTypesMeta, 'missingImplementations'>
> = TResolvedTypesMeta extends TypegenEnabled
  ? IsNever<
      Values<
        {
          [K in keyof TMissingImplementations]: TMissingImplementations[K];
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

// we don't even have to do that much here, technically, because `T & unknown` is equivalent to `T`
// however, this doesn't display nicely in IDE tooltips, so let's fix this
type MergeWithInternalEvents<TIndexedEvents, TInternalEvents> = TIndexedEvents &
  // alternatively we could consider using key remapping in mapped types for this in the future
  // in theory it would be a single iteration rather than two
  Pick<TInternalEvents, Exclude<keyof TInternalEvents, keyof TIndexedEvents>>;

export type ResolveTypegenMeta<
  TTypesMeta extends TypegenConstraint,
  TEvent extends EventObject,
  TAction extends BaseActionObject
> = TTypesMeta extends TypegenEnabled
  ? TTypesMeta & {
      indexedActions: IndexByType<TAction>;
      indexedEvents: MergeWithInternalEvents<
        IndexByType<TEvent>,
        Prop<TTypesMeta, 'internalEvents'>
      >;
    }
  : TypegenDisabled;

export type TypegenMachineOptionsActions<
  TContext,
  TResolvedTypesMeta,
  TEventsCausingActions = Prop<TResolvedTypesMeta, 'eventsCausingActions'>,
  TIndexedEvents = Prop<TResolvedTypesMeta, 'indexedEvents'>,
  TIndexedActions = Prop<TResolvedTypesMeta, 'indexedActions'>
> = {
  [K in keyof TEventsCausingActions]?:
    | ActionObject<
        TContext,
        Cast<Prop<TIndexedEvents, TEventsCausingActions[K]>, EventObject>
      >
    | ActionFunction<
        TContext,
        Cast<Prop<TIndexedEvents, TEventsCausingActions[K]>, EventObject>,
        Cast<Prop<TIndexedActions, K>, BaseActionObject>
      >;
};

export type TypegenMachineOptionsDelays<
  TContext,
  TResolvedTypesMeta,
  TEventsCausingDelays = Prop<TResolvedTypesMeta, 'eventsCausingDelays'>,
  TIndexedEvents = Prop<TResolvedTypesMeta, 'indexedEvents'>
> = {
  [K in keyof TEventsCausingDelays]?: DelayConfig<
    TContext,
    Cast<Prop<TIndexedEvents, TEventsCausingDelays[K]>, EventObject>
  >;
};

export type TypegenMachineOptionsGuards<
  TContext,
  TResolvedTypesMeta,
  TEventsCausingGuards = Prop<TResolvedTypesMeta, 'eventsCausingGuards'>,
  TIndexedEvents = Prop<TResolvedTypesMeta, 'indexedEvents'>
> = {
  [K in keyof TEventsCausingGuards]?: ConditionPredicate<
    TContext,
    Cast<Prop<TIndexedEvents, TEventsCausingGuards[K]>, EventObject>
  >;
};

export type TypegenMachineOptionsServices<
  TContext,
  TResolvedTypesMeta,
  TEventsCausingServices = Prop<TResolvedTypesMeta, 'eventsCausingServices'>,
  TIndexedEvents = Prop<TResolvedTypesMeta, 'indexedEvents'>
> = {
  [K in keyof TEventsCausingServices]?: InvokeCreator<
    TContext,
    Cast<Prop<TIndexedEvents, TEventsCausingServices[K]>, EventObject>
  >;
};

type MakeKeysRequired<T extends string> = { [K in T]: unknown };

type MaybeMakeMissingImplementationsRequired<
  TImplementationType,
  TMissingImplementationsForType,
  TRequireMissingImplementations
> = TRequireMissingImplementations extends true
  ? IsNever<TMissingImplementationsForType> extends true
    ? {}
    : {
        [K in Cast<TImplementationType, string>]: MakeKeysRequired<
          Cast<TMissingImplementationsForType, string>
        >;
      }
  : {};

type GenerateActionsConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = MaybeMakeMissingImplementationsRequired<
  'actions',
  Prop<TMissingImplementations, 'actions'>,
  TRequireMissingImplementations
> & {
  actions?: TypegenMachineOptionsActions<TContext, TResolvedTypesMeta>;
};

type GenerateDelaysConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = MaybeMakeMissingImplementationsRequired<
  'delays',
  Prop<TMissingImplementations, 'delays'>,
  TRequireMissingImplementations
> & {
  delays?: TypegenMachineOptionsDelays<TContext, TResolvedTypesMeta>;
};

type GenerateGuardsConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = MaybeMakeMissingImplementationsRequired<
  'guards',
  Prop<TMissingImplementations, 'guards'>,
  TRequireMissingImplementations
> & {
  guards?: TypegenMachineOptionsGuards<TContext, TResolvedTypesMeta>;
};

type GenerateServicesConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> = MaybeMakeMissingImplementationsRequired<
  'services',
  Prop<TMissingImplementations, 'services'>,
  TRequireMissingImplementations
> & {
  services?: TypegenMachineOptionsServices<TContext, TResolvedTypesMeta>;
};

export type TypegenMachineOptions<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations = Prop<TResolvedTypesMeta, 'missingImplementations'>
> = GenerateActionsConfigPart<
  TContext,
  TResolvedTypesMeta,
  TRequireMissingImplementations,
  TMissingImplementations
> &
  GenerateDelaysConfigPart<
    TContext,
    TResolvedTypesMeta,
    TRequireMissingImplementations,
    TMissingImplementations
  > &
  GenerateGuardsConfigPart<
    TContext,
    TResolvedTypesMeta,
    TRequireMissingImplementations,
    TMissingImplementations
  > &
  GenerateServicesConfigPart<
    TContext,
    TResolvedTypesMeta,
    TRequireMissingImplementations,
    TMissingImplementations
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
