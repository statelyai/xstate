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
import { fromActorRef } from './fromActorRef.ts';
import { useActorRef } from './useActorRef.ts';

/**
 * Creates an actor from `logic`, or uses an already-created actor (e.g. from
 * `restoreActor`), and subscribes to its snapshot. Create a
 * passed actor once per component instance.
 *
 * @public
 */
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
export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic | Actor<TLogic>,
  options?: ActorOptions<TLogic>
): [
  SnapshotFrom<TLogic>,
  (event: EventFromLogic<TLogic>) => void,
  ActorRefFrom<TLogic>
] {
  const actorRef = (useActorRef as any)(logic, options) as AnyActorRef;
  return [fromActorRef(actorRef)(), actorRef.send, actorRef as any];
}
