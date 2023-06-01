import { ActorRef, ActorLogic, EventObject, interpret } from 'xstate';
import { onBeforeUnmount } from 'vue';

/**
 * Vue composable that spawns an `ActorRef` with the specified `logic`.
 * The returned `ActorRef` can be used with the `useActor(actorRef)` hook.
 *
 * @param logic The actor logic to spawn
 * @returns An ActorRef with the specified `logic`
 */
export function useSpawn<TState, TEvent extends EventObject>(
  logic: ActorLogic<TEvent, TState>
): ActorRef<TEvent, TState> {
  const actorRef = interpret(logic);

  actorRef.start?.();
  onBeforeUnmount(() => {
    actorRef.stop?.();
  });

  return actorRef;
}
