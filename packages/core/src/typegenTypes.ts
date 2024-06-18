import {
  EventObject,
  IndexByType,
  IsNever,
  ParameterizedObject,
  ProvidedActor,
  OutputFrom
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
