import { onDestroy } from 'svelte';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  createActor,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys,
  type RequiredActorOptionsFor
} from 'xstate';

/**
 * Creates an actor from `logic`, or uses an already-created actor (e.g. from
 * `restoreActor`), starting it immediately and stopping it on destroy. Create a
 * passed actor once per component instance.
 *
 * @public
 */
export function useActorRef<TLogic extends AnyActorLogic>(
  actor: Actor<TLogic>
): Actor<TLogic>;
export function useActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): Actor<TLogic>;
export function useActorRef(
  logicOrActor: AnyActorLogic | Actor<AnyActorLogic>,
  options?: ActorOptions<AnyActorLogic>
): Actor<AnyActorLogic> {
  const actorRef = (
    logicOrActor instanceof Actor
      ? logicOrActor
      : createActor(logicOrActor, options)
  ).start();
  onDestroy(() => actorRef.stop());
  return actorRef;
}
