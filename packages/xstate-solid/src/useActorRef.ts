import { createEffect, createMemo, onSettled, type Accessor } from 'solid-js';
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
 * Given a function that returns an actor, the actor is derived: when the
 * function returns a new actor, the old one is stopped and the new one
 * started. To follow an actor without owning it, use `fromActorRef`.
 *
 * @public
 */
export function useActorRef<TLogic extends AnyActorLogic>(
  actor: () => Actor<TLogic>
): Accessor<ActorRefFrom<TLogic>>;
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
  logicOrActor:
    | AnyActorLogic
    | Actor<AnyActorLogic>
    | (() => Actor<AnyActorLogic>),
  options?: ActorOptions<AnyActorLogic>
): any {
  if (typeof logicOrActor === 'function') {
    const actor = createMemo(logicOrActor);
    createEffect(actor, (actorRef) => {
      actorRef.start();
      return () => actorRef.stop();
    });
    return actor;
  }

  const actorRef =
    logicOrActor instanceof Actor
      ? logicOrActor
      : createActor(logicOrActor, options);

  onSettled(() => {
    actorRef.start();
    return () => actorRef.stop();
  });

  return actorRef;
}
