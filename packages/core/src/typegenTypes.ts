import {
  BaseActionObject,
  EventObject,
  IndexByType,
  IsNever,
  Prop,
  Values,
  IsAny,
  ResolvedMachineSchema,
  ResolvedTypeContainer
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
  TResolvedTypes extends ResolvedTypeContainer,
  TMissingImplementations = Prop<
    TResolvedTypes['TResolvedTypesMeta'],
    'missingImplementations'
  >
> = IsAny<TResolvedTypes['TResolvedTypesMeta']> extends true
  ? true
  : TResolvedTypes['TResolvedTypesMeta'] extends TypegenEnabled
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

type AllowAllEvents = {
  eventsCausingActions: Record<string, string>;
  eventsCausingDelays: Record<string, string>;
  eventsCausingGuards: Record<string, string>;
  eventsCausingServices: Record<string, string>;
};

export type ResolveTypegenMeta<
  TResolvedMachineSchema extends ResolvedMachineSchema,
  TTypesMeta extends TypegenConstraint
> = TResolvedMachineSchema & {
  TResolvedTypesMeta: TTypesMeta extends TypegenEnabled
    ? TTypesMeta & {
        indexedActions: IndexByType<TResolvedMachineSchema['TAction']>;
        indexedEvents: MergeWithInternalEvents<
          IndexByType<TResolvedMachineSchema['TEvent']>,
          Prop<TTypesMeta, 'internalEvents'>
        >;
      }
    : MarkAllImplementationsAsProvided<TypegenDisabled> &
        AllowAllEvents & {
          indexedActions: IndexByType<TResolvedMachineSchema['TAction']>;
          indexedEvents: Record<string, TResolvedMachineSchema['TEvent']> & {
            __XSTATE_ALLOW_ANY_INVOKE_DATA_HACK__: { data: any };
          };
          invokeSrcNameMap: Record<
            string,
            '__XSTATE_ALLOW_ANY_INVOKE_DATA_HACK__'
          >;
        };
};
