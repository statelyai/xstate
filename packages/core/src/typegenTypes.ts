import {
  Compute,
  EventObject,
  IndexByType,
  IsNever,
  Prop,
  Values,
  IsAny,
  ParameterizedObject,
  ProvidedActor,
  OutputFrom,
  AnyActorLogic,
  IndexByProp
} from './types.ts';

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
   * ```js
   * key: 'xstate.done.actor.myActor'
   * value: {
   *   type: 'xstate.done.actor.myActor';
   *   data: unknown;
   *   __tip: 'Declare the type in event types!';
   * }
   * ```
   */
  internalEvents: {};
  /**
   * Maps the src of the invoked actor to the event type that includes its known id
   *
   * key: 'invokeSrc'
   * value: 'xstate.done.actor.invokeName'
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
  resolved: TypegenMeta & {
    indexedActors: Record<string, ProvidedActor>;
    indexedActions: Record<string, ParameterizedObject>;
    indexedEvents: Record<string, EventObject>;
    indexedGuards: Record<string, ParameterizedObject>;
    indexedDelays: Record<string, ParameterizedObject>;
  };
}

export type TypegenConstraint = TypegenEnabled | TypegenDisabled;

// if combined union of all missing implementation types is never then everything has been provided
export type AreAllImplementationsAssumedToBeProvided<
  TResolvedTypesMeta,
  TMissingImplementations = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'missingImplementations'
  >
> = IsAny<TResolvedTypesMeta> extends true
  ? true
  : TResolvedTypesMeta extends TypegenEnabled
    ? IsNever<
        Values<{
          [K in keyof TMissingImplementations]: TMissingImplementations[K];
        }>
      > extends true
      ? true
      : false
    : true;

export type MissingImplementationsError<
  TResolvedTypesMeta,
  TMissingImplementations = Prop<
    Prop<TResolvedTypesMeta, 'resolved'>,
    'missingImplementations'
  >
> = Compute<
  [
    'Some implementations missing',
    Values<{
      [K in keyof TMissingImplementations]: TMissingImplementations[K];
    }>
  ]
>;

interface AllImplementationsProvided {
  missingImplementations: {
    actions: never;
    actors: never;
    delays: never;
    guards: never;
  };
}

export interface MarkAllImplementationsAsProvided<TResolvedTypesMeta> {
  '@@xstate/typegen': Prop<TResolvedTypesMeta, '@@xstate/typegen'>;
  resolved: Prop<TResolvedTypesMeta, 'resolved'> & AllImplementationsProvided;
}

type GenerateActorEvents<
  TActor extends ProvidedActor,
  TInvokeSrcNameMap
> = string extends TActor['src']
  ? // TActor is pretty much required if one wants to have actor types
    // using never here allows typegen to inject internal events with "hints" that the actor type is missing
    never
  : // distribute over union
    TActor extends any
    ? {
        type: // 1. if the actor has an id, use that
        TActor['id'] extends string
          ? `xstate.done.actor.${TActor['id']}`
          : // 2. if the ids were inferred by typegen then use those
            // this doesn't contain *all* possible event types since we can't track spawned actors today
            // however, those xstate.done.actor events shouldn't exactly be usable by/surface to the user anyway
            TActor['src'] extends keyof TInvokeSrcNameMap
            ? `xstate.done.actor.${TInvokeSrcNameMap[TActor['src']] & string}`
            : // 3. finally use the fallback type
              `xstate.done.actor.${string}`;
        output: OutputFrom<TActor['logic']>;
      }
    : never;

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

type IndexParameterizedImplementation<
  TParameterizedImplementation extends ParameterizedObject,
  TCausingLookup
> = string extends TParameterizedImplementation['type']
  ? // this ensures that we can error on provided implementations when no implementations could be inferred by typegen
    // technically, it's not even a type issue to accept them since we just won't try to execute them
    // that is - if our typegen would be 100% correct and if it could actually handle all scenarios that we consider valid
    // (or at least if it would error on the ones that we can't handle)
    // it should still be at least a lint warning or something if the user provides an implementation that can't be executed
    // so there is still value in this - but we can reevaluate this later
    // note that we don't exactly do the same right now when `TAction`/`TGuard`/etc *is* provided together with typegen information
    // so the behavior around this could be considered inconsistent (one way or another: either we should always error or we shouldn't error at all)
    IsNever<TCausingLookup> extends true
    ? never
    : Record<keyof TCausingLookup, ParameterizedObject>
  : IndexByType<TParameterizedImplementation>;

type WrapIntoParameterizedObject<T extends string> = T extends any
  ? { type: T }
  : never;

export interface ResolveTypegenMeta<
  TTypesMeta extends TypegenConstraint,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string
> {
  '@@xstate/typegen': TTypesMeta['@@xstate/typegen'];
  resolved: {
    enabled: TTypesMeta & {
      indexedActions: IndexParameterizedImplementation<
        TAction,
        Prop<TTypesMeta, 'eventsCausingActions'>
      >;
      // we could add `id` based on typegen information (in both branches)
      // but it doesn't seem to be needed for anything right now
      indexedActors: string extends TActor['src']
        ? Record<
            keyof Prop<TTypesMeta, 'eventsCausingActors'>,
            { logic: AnyActorLogic }
          >
        : IndexByProp<TActor, 'src'>;
      indexedEvents: MergeWithInternalEvents<
        IndexByType<
          | (string extends TEvent['type'] ? never : TEvent)
          | GenerateActorEvents<TActor, Prop<TTypesMeta, 'invokeSrcNameMap'>>
        >,
        Prop<TTypesMeta, 'internalEvents'>
      >;
      indexedGuards: IndexParameterizedImplementation<
        TGuard,
        Prop<TTypesMeta, 'eventsCausingGuards'>
      >;
      // delays are not parameterized but we can reuse this helper and the style of helpers depending on this if we convert delays to paremeterized objects here
      // if we ever decide to allow parameterized delays then we'll only have to adjust this place which is nice
      indexedDelays: IndexParameterizedImplementation<
        WrapIntoParameterizedObject<TDelay>,
        Prop<TTypesMeta, 'eventsCausingDelays'>
      >;
      tags: string extends TTag ? Prop<TTypesMeta, 'tags'> : TTag;
    };
    disabled: TypegenDisabled &
      AllImplementationsProvided &
      AllowAllEvents & {
        indexedActions: IndexByType<TAction>;
        indexedActors: IndexByProp<TActor, 'src'>;
        // we don't have to iterate through this since we'll never index a concrete event type on this without the typegen meta
        indexedEvents: Record<string, TEvent>;
        indexedGuards: IndexByType<TGuard>;
        indexedDelays: IndexByType<WrapIntoParameterizedObject<TDelay>>;
        invokeSrcNameMap: Record<string, string>;
        tags: TTag;
      };
  }[IsNever<TTypesMeta> extends true
    ? 'disabled'
    : TTypesMeta['@@xstate/typegen'] extends true
      ? 'enabled'
      : 'disabled'];
}
