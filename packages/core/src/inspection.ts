import {
  ActorRefLike,
  AnyActorLogic,
  AnyEventObject,
  AnyTransitionDefinition,
  Snapshot
} from './types.ts';
import type { StandardSchemaV1 } from './schema.types.ts';
import type { EventRejectionReason } from './system.ts';

/**
 * A record of a single action executed during a transition.
 *
 * Carried in {@link TransitionInspectionEvent.actions}, this replaces the v5
 * standalone `@xstate.action` inspection event.
 *
 * @experimental
 */
export interface ActionRecord {
  /** The action type (e.g. the action creator name or `'(anonymous)'`). */
  type: string;
  /** The resolved params for the action, if any. */
  params: unknown;
}

/**
 * A record of a single event relayed to another actor during a transition.
 *
 * Carried in {@link TransitionInspectionEvent.sent}, this captures the send on
 * the _sender's_ transition — including delayed/scheduled sends that may never
 * deliver — distinct from the target actor's own processed-event transition.
 *
 * @experimental
 */
export interface SentRecord {
  /** The actor the event was sent to. */
  targetRef: ActorRefLike;
  /** The `id` of the target actor. */
  targetId: string;
  /** The event that was sent. */
  event: AnyEventObject;
  /** The delay (ms) for a scheduled send, or `undefined` for an immediate send. */
  delay?: number;
  /** The scheduling id for a scheduled send, used for cancellation. */
  id?: string;
}

interface BaseInspectionEventProperties {
  /** The session ID of the root actor. */
  rootId: string;
  /**
   * The relevant actorRef for the inspection event.
   *
   * - For `@xstate.actor` events, this is the registered actor.
   * - For `@xstate.transition` events, this is the actor that transitioned.
   */
  actorRef: ActorRefLike;
}

/**
 * Announces that an actor was created in the system (the root actor and every
 * spawned/invoked child). This is the single topology event — it carries the
 * actor identity and parent relationship needed to draw the actor graph before
 * any transitions occur.
 *
 * Actor _stop_ is derivable from `snapshot.status` on the actor's final
 * `@xstate.transition` event, so there is no separate stop event.
 *
 * @experimental
 */
export interface ActorInspectionEvent extends BaseInspectionEventProperties {
  type: '@xstate.actor';
  /** The parent actor, or `undefined` for the root actor. */
  parentRef: ActorRefLike | undefined;
  /** The `id` of the actor. */
  id: string;
  /** The source logic (or its referenced string) the actor was created from. */
  src: string | AnyActorLogic;
  /** The initial snapshot of the actor. */
  snapshot: Snapshot<unknown>;
}

/**
 * Announces an actor transition.
 *
 * All facets are flat and always present so consumers can read `event.actions`,
 * `event.sent`, and `event.microsteps` directly without narrowing on absent
 * properties. This is a superset of the v5
 * `@xstate.event`/`@xstate.snapshot`/`@xstate.action`/`@xstate.microstep`
 * events.
 *
 * @experimental
 */
export interface TransitionInspectionEvent extends BaseInspectionEventProperties {
  type: '@xstate.transition';
  eventType: string;
  /** The event that caused the transition. */
  event: AnyEventObject;
  /** The source actor that sent the event, if any. */
  sourceRef: ActorRefLike | undefined;
  /** The target actor of the transition (usually the same as `actorRef`). */
  targetRef: ActorRefLike | undefined;
  /** The resulting snapshot of the transition. */
  snapshot: Snapshot<unknown>;
  /** The microstep transition definitions taken (always present). */
  microsteps: AnyTransitionDefinition[];
  /** The actions executed during the transition (always present). */
  actions: ActionRecord[];
  /** The events relayed to other actors during the transition (always present). */
  sent: SentRecord[];
}

/**
 * Emitted when an event could not be delivered to its target actor (a dead
 * letter): a send to a stopped actor, an invalid external event payload, an
 * internal event type sent from outside its owning actor, or an `enq.sendTo`
 * whose target is missing. For a missing target, `actorRef` is the sending
 * actor.
 *
 * A dead letter is not an actor error: the target actor's snapshot is
 * unchanged.
 *
 * @experimental
 */
export interface DeadLetterInspectionEvent extends BaseInspectionEventProperties {
  type: '@xstate.deadletter';
  /** The actor that sent the event, or `undefined` when sent externally. */
  sourceRef: ActorRefLike | undefined;
  /** The undelivered event. */
  event: AnyEventObject;
  /**
   * Why the event was not delivered: `'stopped'`, `'invalidEvent'`,
   * `'internalEvent'` or `'missingTarget'`.
   */
  reason: EventRejectionReason;
  /** Standard Schema issues for `'invalidEvent'` dead letters. */
  issues?: readonly StandardSchemaV1.Issue[];
  /** The underlying error describing a delivery-boundary rejection. */
  error?: Error;
}

/**
 * A lossless inspection protocol:
 *
 * - `@xstate.actor` — actor topology (identity + parent), drawable up front.
 * - `@xstate.transition` — every transition facet: event, snapshot, source,
 *   microsteps, executed actions, and sent/scheduled events.
 *
 * POLICY: the protocol is exactly `@xstate.actor` and `@xstate.transition`. Do
 * not add event types to this union. Dead letters (undeliverable events) are
 * not inspection events: observe them with the `onRejectedEvent` actor option,
 * the `deadLetter` runtime operation, or the development warning. The protocol is deliberately
 * minimal so inspectors can be written against a fixed set. New observable
 * facets belong as fields on `@xstate.transition` (or on the existing events),
 * or are derived by the consumer. Examples of derivation: an unhandled event
 * is a `@xstate.transition` whose `snapshot` is the same reference as the
 * previous one with no `actions`; actor stop is the final transition's
 * `snapshot.status`. The `inspection.conformance.v6.test.ts` type test pins
 * the member list.
 *
 * @experimental
 */
export type InspectionEvent =
  | ActorInspectionEvent
  | TransitionInspectionEvent
  | DeadLetterInspectionEvent;
