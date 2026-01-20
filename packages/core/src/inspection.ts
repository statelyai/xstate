import {
  ActorRefLike,
  AnyEventObject,
  AnyTransitionDefinition,
  Snapshot
} from './types.ts';

export type InspectionEvent =
  | InspectedSnapshotEvent
  | InspectedEventEvent
  | InspectedActorEvent
  | InspectedMicrostepEvent
  | InspectedActionEvent
  | InspectedSubscriptionEvent;

interface BaseInspectionEventProperties<T extends ActorRefLike = ActorRefLike> {
  rootId: string; // the session ID of the root
  /**
   * The relevant actorRef for the inspection event.
   *
   * - For snapshot events, this is the `actorRef` of the snapshot.
   * - For event events, this is the target `actorRef` (recipient of event).
   * - For actor events, this is the `actorRef` of the registered actor.
   * - For subscription events, this is the `actorRef` of the actor that is being
   *   subscribed to.
   */
  actorRef: T;
}

export interface InspectedSnapshotEvent extends BaseInspectionEventProperties {
  type: '@xstate.snapshot';
  event: AnyEventObject; // { type: string, ... }
  snapshot: Snapshot<unknown>;
}

export interface InspectedMicrostepEvent extends BaseInspectionEventProperties {
  type: '@xstate.microstep';
  event: AnyEventObject; // { type: string, ... }
  snapshot: Snapshot<unknown>;
  _transitions: AnyTransitionDefinition[];
}

export interface InspectedActionEvent extends BaseInspectionEventProperties {
  type: '@xstate.action';
  action: {
    type: string;
    params: unknown;
  };
}

export interface InspectedEventEvent extends BaseInspectionEventProperties {
  type: '@xstate.event';
  // The source might not exist, e.g. when:
  // - root init events
  // - events sent from external (non-actor) sources
  sourceRef: ActorRefLike | undefined;
  event: AnyEventObject; // { type: string, ... }
}

export interface InspectedSubscriptionEvent
  extends BaseInspectionEventProperties<ActorRefLike & { systemId?: string }> {
  type: '@xstate.subscription';
  subscriptionId: string | undefined;
}

export interface InspectedActorEvent extends BaseInspectionEventProperties {
  type: '@xstate.actor';
}
