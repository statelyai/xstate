import { ActorRef, Behavior, EventObject } from 'xstate';
import * as XState from 'xstate';
import useConstant from './useConstant';

if (process.env.NODE_ENV === 'development' && !('__spawnBehavior' in XState)) {
  throw new Error('`useSpawn` requires at least xstate@4.22.1');
}

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
  const actorRef = useConstant(() => {
    return XState.__spawnBehavior(behavior);
  });

  return actorRef;
}
