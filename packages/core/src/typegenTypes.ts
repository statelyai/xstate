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
  Values,
  IsAny
} from './types';

export interface TypegenDisabled {
  '@@xstate/typegen': false;
}
export interface TypegenEnabled {
  '@@xstate/typegen': true;
}
export interface TypegenMeta extends TypegenEnabled {
  /**
   * Allows you to specify all the results of state.matches
   */
  matchesStates: string | {};
  /**
   * Allows you to specify all tags used by the machine
   */
  tags: string;
  /**
   * Allows you to specify all the missing implementations
   * of the machine
   */
  missingImplementations: {
    actions: string;
    delays: string;
    guards: string;
    services: string;
  };
  /**
   * A map for the internal events of the machine.
   *
   * key: 'done.invoke.myService'
   * value: {
   *   type: 'done.invoke.myService';
   *   data: unknown;
   *   __tip: 'Declare the type in event types!';
   * }
   */
  internalEvents: {};
  /**
   * Maps the name of the service to the event type
   * of the done.invoke action
   *
   * key: 'invokeSrc'
   * value: 'done.invoke.invokeName'
   */
  invokeSrcNameMap: Record<string, string>;
  /**
   * Keeps track of which events lead to which
   * actions.
   *
   * Key: 'EVENT_NAME'
   * Value: 'actionName' | 'otherActionName'
   */
  eventsCausingActions: Record<string, string>;
  /**
   * Keeps track of which events lead to which
   * delays.
   *
   * Key: 'EVENT_NAME'
   * Value: 'delayName' | 'otherDelayName'
   */
  eventsCausingDelays: Record<string, string>;
  /**
   * Keeps track of which events lead to which
   * guards.
   *
   * Key: 'EVENT_NAME'
   * Value: 'guardName' | 'otherGuardName'
   */
  eventsCausingGuards: Record<string, string>;
  /**
   * Keeps track of which events lead to which
   * services.
   *
   * Key: 'EVENT_NAME'
   * Value: 'serviceName' | 'otherServiceName'
   */
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
> = IsAny<TResolvedTypesMeta> extends true
  ? true
  : TResolvedTypesMeta extends TypegenEnabled
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

// type AllowAllEvents<TEvent extends EventObject, TEventType = TEvent['type']> = {
//   eventsCausingActions: Record<string, TEventType>;
//   eventsCausingDelays: Record<string, TEventType>;
//   eventsCausingGuards: Record<string, TEventType>;
//   eventsCausingServices: Record<string, TEventType>;
// };

type AllowAllEvents = {
  eventsCausingActions: Record<string, string>;
  eventsCausingDelays: Record<string, string>;
  eventsCausingGuards: Record<string, string>;
  eventsCausingServices: Record<string, string>;
};

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
  : MarkAllImplementationsAsProvided<TypegenDisabled> &
      AllowAllEvents & {
        indexedActions: IndexByType<TAction>;
        indexedEvents: Record<string, TEvent> & {
          __XSTATE_ALLOW_ANY_INVOKE_DATA_HACK__: { data: any };
        };
        invokeSrcNameMap: Record<
          string,
          '__XSTATE_ALLOW_ANY_INVOKE_DATA_HACK__'
        >;
      };

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
  TIndexedEvents = Prop<TResolvedTypesMeta, 'indexedEvents'>,
  TInvokeSrcNameMap = Prop<TResolvedTypesMeta, 'invokeSrcNameMap'>
> = {
  [K in keyof TEventsCausingServices]?: InvokeCreator<
    TContext,
    Cast<Prop<TIndexedEvents, TEventsCausingServices[K]>, EventObject>,
    Prop<Prop<TIndexedEvents, Prop<TInvokeSrcNameMap, K>>, 'data'>
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
