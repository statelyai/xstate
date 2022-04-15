import { ActorRef, Behavior, EventObject } from 'xstate';
import { onBeforeUnmount } from 'vue';
import { createActorRef } from 'xstate/actors';

/**
 * Vue composable that spawns an `ActorRef` with the specified `behavior`.
 * The returned `ActorRef` can be used with the `useActor(actorRef)` hook.
 *
 * @param behavior The actor behavior to spawn
 * @returns An ActorRef with the specified `behavior`
 */
export function useSpawn<TState, TEvent extends EventObject>(
  behavior: Behavior<TEvent, TState>
): ActorRef<TEvent, TState> {
  const actorRef = createActorRef(behavior);

  actorRef.start!();
  onBeforeUnmount(() => {
    actorRef.stop!();
  });

  return actorRef;
}
