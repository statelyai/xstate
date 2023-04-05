import { useEffect } from 'react';
import { ActorRef, ActorBehavior, EventObject, interpret } from 'xstate';
import useConstant from './useConstant.ts';

/**
 * React hook that spawns an `ActorRef` with the specified `behavior`.
 * The returned `ActorRef` can be used with the `useActor(actorRef)` hook.
 *
 * @param behavior The actor behavior to spawn
 * @returns An ActorRef with the specified `behavior`
 */
export function useSpawn<TState, TEvent extends EventObject>(
  behavior: ActorBehavior<TEvent, TState>
): ActorRef<TEvent, TState> {
  const actorRef = useConstant(() => {
    // TODO: figure out what to do about the name argument
    return interpret(behavior);
  });

  useEffect(() => {
    actorRef.start?.();
    return () => {
      actorRef!.stop?.();
    };
  }, []);

  return actorRef;
}
