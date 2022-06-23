import {
  ActorRef,
  Behavior,
  EventObject,
  spawnBehavior,
  SpawnBehaviorOptions
} from 'xstate';

/**
 * Vue composable that spawns an `ActorRef` with the specified `behavior`.
 * The returned `ActorRef` can be used with the `useActor(actorRef)` hook.
 *
 * @param behavior The actor behavior to spawn
 * @returns An ActorRef with the specified `behavior`
 */
export function useSpawn<TState, TEvent extends EventObject>(
  behavior: Behavior<TEvent, TState>,
  options?: SpawnBehaviorOptions
): ActorRef<TEvent, TState> {
  const actorRef = spawnBehavior(behavior, options);
  return actorRef;
}
