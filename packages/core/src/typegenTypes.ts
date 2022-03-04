import {
  BaseActionObject,
  EventObject,
  IndexByType,
  IsNever,
  Prop,
  Values,
  IsAny,
  ActorMap,
  Cast
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
    actors: string;
    delays: string;
    guards: string;
  };
  /**
   * A map for the internal events of the machine.
   *
   * key: 'done.invoke.myActor'
   * value: {
   *   type: 'done.invoke.myActor';
   *   data: unknown;
   *   __tip: 'Declare the type in event types!';
   * }
   */
  internalEvents: {};
  /**
   * Maps the name of the actor to the event type
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
   * actors.
   *
   * Key: 'EVENT_NAME'
   * Value: 'actorName' | 'otherActorName'
   */
  eventsCausingActors: Record<string, string>;
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
    actors: never;
    delays: never;
    guards: never;
  };
};

type GenerateActorEvent<
  TActorName,
  TEventType,
  TActorMap extends ActorMap
> = TEventType extends any
  ? {
      type: TEventType;
    } & Prop<TActorMap, TActorName>
  : never;

type GenerateActorEvents<
  TActorMap extends ActorMap,
  TInvokeSrcNameMap
> = string extends keyof TActorMap
  ? never
  : Cast<
      {
        [K in keyof TInvokeSrcNameMap]: GenerateActorEvent<
          K,
          TInvokeSrcNameMap[K],
          TActorMap
        >;
      }[keyof TInvokeSrcNameMap],
      EventObject
    >;

// we don't even have to do that much here, technically, because `T & unknown` is equivalent to `T`
// however, this doesn't display nicely in IDE tooltips, so let's fix this
type MergeWithInternalEvents<TIndexedEvents, TInternalEvents> = TIndexedEvents &
  // alternatively we could consider using key remapping in mapped types for this in the future
  // in theory it would be a single iteration rather than two
  Pick<TInternalEvents, Exclude<keyof TInternalEvents, keyof TIndexedEvents>>;

type AllowAllEvents = {
  eventsCausingActions: Record<string, string>;
  eventsCausingActors: Record<string, string>;
  eventsCausingDelays: Record<string, string>;
  eventsCausingGuards: Record<string, string>;
};

export type ResolveTypegenMeta<
  TTypesMeta extends TypegenConstraint,
  TEvent extends EventObject,
  TAction extends BaseActionObject,
  TActorMap extends ActorMap
> = TTypesMeta extends TypegenEnabled
  ? TTypesMeta & {
      indexedActions: IndexByType<TAction>;
      indexedEvents: MergeWithInternalEvents<
        IndexByType<
          | (string extends TEvent['type'] ? never : TEvent)
          | GenerateActorEvents<TActorMap, Prop<TTypesMeta, 'invokeSrcNameMap'>>
        >,
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
