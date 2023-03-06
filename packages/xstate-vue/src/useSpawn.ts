import { ActorRef, ActorBehavior, EventObject, interpret } from 'xstate';
import { onBeforeUnmount } from 'vue';

/**
 * Vue composable that spawns an `ActorRef` with the specified `behavior`.
 * The returned `ActorRef` can be used with the `useActor(actorRef)` hook.
 *
 * @param behavior The actor behavior to spawn
 * @returns An ActorRef with the specified `behavior`
 */
export function useSpawn<TState, TEvent extends EventObject>(
  behavior: ActorBehavior<TEvent, TState>
): ActorRef<TEvent, TState> {
  const actorRef = interpret(behavior);

  actorRef.start?.();
  onBeforeUnmount(() => {
    actorRef.system.stop?.();
  });

  return actorRef;
}
