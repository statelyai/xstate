import { onCleanup, onMount } from 'solid-js';
import type {
  ActorOptions,
  ActorRefFrom,
  AnyActorLogic,
  ConditionalRequired,
  IsNotNever,
  RequiredActorOptionsKeys,
  RequiredActorOptionsFor
} from 'xstate';
import { Actor, createActor } from 'xstate';

/**
 * Creates an actor from `logic`, or uses an already-created actor (e.g. from
 * `restoreActor`), starting it on mount and stopping it on unmount. Create a
 * passed actor once per component instance.
 *
 * @public
 */
export function useActorRef<TLogic extends AnyActorLogic>(
  actor: Actor<TLogic>
): ActorRefFrom<TLogic>;
export function useActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): ActorRefFrom<TLogic>;
export function useActorRef(
  logicOrActor: AnyActorLogic | Actor<AnyActorLogic>,
  options?: ActorOptions<AnyActorLogic>
): ActorRefFrom<AnyActorLogic> {
  const actorRef =
    logicOrActor instanceof Actor
      ? logicOrActor
      : createActor(logicOrActor, options);

  onMount(() => {
    actorRef.start();
    onCleanup(() => actorRef.stop());
  });

  return actorRef as any;
}
