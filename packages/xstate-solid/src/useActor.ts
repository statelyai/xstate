import type { Accessor } from 'solid-js';
import {
  Actor,
  EventFromLogic,
  type ActorOptions,
  type ActorRefFrom,
  type AnyActorLogic,
  type AnyActorRef,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys,
  type RequiredActorOptionsFor,
  type SnapshotFrom
} from 'xstate';
import { snapshotStore } from './fromActorRef.ts';
import { useActorRef } from './useActorRef.ts';

/**
 * Creates an actor from `logic`, or uses an already-created actor (e.g. from
 * `restoreActor`), and subscribes to its snapshot. Create a
 * passed actor once per component instance.
 *
 * Given a function that returns an actor, the actor is derived (see
 * `useActorRef`) and the snapshot follows the current actor.
 *
 * @public
 */
export function useActor<TLogic extends AnyActorLogic>(
  actor: () => Actor<TLogic>
): [
  SnapshotFrom<TLogic>,
  (event: EventFromLogic<TLogic>) => void,
  Accessor<ActorRefFrom<TLogic>>
];
export function useActor<TLogic extends AnyActorLogic>(
  actor: Actor<TLogic>
): [
  SnapshotFrom<TLogic>,
  (event: EventFromLogic<TLogic>) => void,
  ActorRefFrom<TLogic>
];
export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): [
  SnapshotFrom<TLogic>,
  (event: EventFromLogic<TLogic>) => void,
  ActorRefFrom<TLogic>
];
export function useActor(
  logic: AnyActorLogic | Actor<AnyActorLogic> | (() => Actor<AnyActorLogic>),
  options?: ActorOptions<AnyActorLogic>
): any {
  const actorRef = (useActorRef as any)(logic, options) as
    | AnyActorRef
    | Accessor<AnyActorRef>;
  const send =
    typeof actorRef === 'function'
      ? (event: any) => actorRef().send(event)
      : actorRef.send;
  return [snapshotStore(actorRef)[0], send, actorRef];
}
