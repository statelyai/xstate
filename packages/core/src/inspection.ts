import {
  ActorRefLike,
  AnyEventObject,
  AnyTransitionDefinition,
  Snapshot
} from './types.ts';

export type InspectionEvent = {
  rootId: string; // the session ID of the root
  /**
   * The relevant actorRef for the inspection event.
   *
   * - For snapshot events, this is the `actorRef` of the snapshot.
   * - For event events, this is the target `actorRef` (recipient of event).
   * - For actor events, this is the `actorRef` of the registered actor.
   */
  actorRef: ActorRefLike;
  type: '@xstate.transition';
  eventType: string;
  event: AnyEventObject; // { type: string, ... }
  sourceRef: ActorRefLike | undefined;
  targetRef: ActorRefLike | undefined;
  snapshot: Snapshot<unknown>;
  microsteps: AnyTransitionDefinition[];
};
