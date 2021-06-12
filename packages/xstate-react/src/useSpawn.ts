import { useMemo } from 'react';
import { ActorRef, Behavior, EventObject } from 'xstate';
import { spawnBehavior } from 'xstate/src/behavior';

/**
 * React hook that spawns an `ActorRef` with the specified `behavior`.
 * The returned `ActorRef` can be used with the `useActor(actorRef)` hook.
 *
 * @param behavior The actor behavior to spawn
 * @returns An ActorRef with the specified `behavior`
 */
export function useSpawn<TState, TEvent extends EventObject>(
  behavior: Behavior<TEvent, TState>
): ActorRef<TEvent, TState> {
  const actorRef = useMemo(() => {
    return spawnBehavior(behavior);
  }, [behavior]);

  return actorRef;
}
