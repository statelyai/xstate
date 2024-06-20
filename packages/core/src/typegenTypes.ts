import {
  EventObject,
  IndexByType,
  IsNever,
  Prop,
  ParameterizedObject,
  ProvidedActor,
  OutputFrom,
  AnyActorLogic,
  IndexByProp
} from './types.ts';

/**
 * @deprecated
 */
export interface TypegenDisabled {
  '@@xstate/typegen': false;
}

/**
 * @deprecated
 */
export interface TypegenEnabled {
  '@@xstate/typegen': true;
}

/**
 * @deprecated
 */
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

/**
 * @deprecated
 */
export interface ResolvedTypegenMeta extends TypegenMeta {
  resolved: TypegenMeta & {
    indexedActors: Record<string, ProvidedActor>;
    indexedActions: Record<string, ParameterizedObject>;
    indexedEvents: Record<string, EventObject>;
    indexedGuards: Record<string, ParameterizedObject>;
    indexedDelays: Record<string, ParameterizedObject>;
  };
}

/**
 * @deprecated
 */
export type TypegenConstraint = TypegenEnabled | TypegenDisabled;

/**
 * @deprecated Always resolves to `true`
 */
export type AreAllImplementationsAssumedToBeProvided<
  _TResolvedTypesMeta,
  _TMissingImplementations = never
> = true;

/**
 * @deprecated Always resolves to `never`
 */
export type MissingImplementationsError<
  _TResolvedTypesMeta,
  _TMissingImplementations = never
> = never;

/**
 * @deprecated
 */
interface AllImplementationsProvided {
  missingImplementations: {
    actions: never;
    actors: never;
    delays: never;
    guards: never;
  };
}

type AllowAllEvents = {
  eventsCausingActions: Record<string, string>;
  eventsCausingActors: Record<string, string>;
  eventsCausingDelays: Record<string, string>;
  eventsCausingGuards: Record<string, string>;
};

type WrapIntoParameterizedObject<T extends string> = T extends any
  ? { type: T }
  : never;

export interface Stuff {
  TEvent: EventObject;
  TActor: ProvidedActor;
  TAction: ParameterizedObject;
  TGuard: ParameterizedObject;
  TDelay: string;
  TTag: string;
  TEmitted: EventObject;
}

/**
 * @deprecated
 */
export interface ResolveTypegenMeta<
  TTypesMeta extends TypegenConstraint,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TEmitted extends EventObject = EventObject
> {
  TEvent: TEvent;
  TActor: TActor;
  TAction: TAction;
  TGuard: TGuard;
  TDelay: TDelay;
  TTag: TTag;
  TEmitted: TEmitted;
  '@@xstate/typegen': TTypesMeta['@@xstate/typegen'];
  resolved: TypegenDisabled &
    AllImplementationsProvided &
    AllowAllEvents & {
      indexedActions: IndexByType<TAction>;
      indexedActors: IndexByProp<TActor, 'src'>;
      // we don't have to iterate through this since we'll never index a concrete event type on this without the typegen meta
      indexedEvents: Record<string, TEvent>;
      indexedGuards: IndexByType<TGuard>;
      indexedDelays: IndexByType<WrapIntoParameterizedObject<TDelay>>;
      tags: TTag;
      emitted: TEmitted;
    };
}
