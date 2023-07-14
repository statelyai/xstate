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
  resolved: TypegenMeta & {
    indexedActors: Record<string, ProvidedActor>;
    indexedActions: Record<string, ParameterizedObject>;
    indexedEvents: Record<string, EventObject>;
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
  _TInvokeSrcNameMap
> = TActor extends { id: infer K }
  ? {
      type: `done.invoke.${K & string}`;
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

export interface ResolveTypegenMeta<
  TTypesMeta extends TypegenConstraint,
  TEvent extends EventObject,
  TAction extends ParameterizedObject,
  TActor extends ProvidedActor
> {
  '@@xstate/typegen': TTypesMeta['@@xstate/typegen'];
  resolved: {
    enabled: TTypesMeta & {
      indexedActions: IndexByType<TAction>;
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
    };
    disabled: TypegenDisabled &
      AllImplementationsProvided &
      AllowAllEvents & {
        indexedActions: IndexByType<TAction>;
        indexedActors: IndexByProp<TActor, 'src'>;
        indexedEvents: Record<string, TEvent> & {
          __XSTATE_ALLOW_ANY_INVOKE_OUTPUT_HACK__: { output: any };
        };
        invokeSrcNameMap: Record<
          string,
          '__XSTATE_ALLOW_ANY_INVOKE_OUTPUT_HACK__'
        >;
      };
  }[IsNever<TTypesMeta> extends true
    ? 'disabled'
    : TTypesMeta extends TypegenEnabled
    ? 'enabled'
    : 'disabled'];
}
