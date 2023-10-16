import {
  ActorRef,
  ActorLogic,
  EventObject,
  createActor,
  Snapshot
} from 'xstate';
import { onBeforeUnmount } from 'vue';

/**
 * Vue composable that spawns an `ActorRef` with the specified `logic`.
 * The returned `ActorRef` can be used with the `useActor(actorRef)` hook.
 *
 * @param logic The actor logic to spawn
 * @returns An ActorRef with the specified `logic`
 */
export function useSpawn<
  TState extends Snapshot<unknown>,
  TEvent extends EventObject
>(logic: ActorLogic<TState, TEvent>): ActorRef<TEvent, TState> {
  const actorRef = createActor(logic);

  actorRef.start?.();
  onBeforeUnmount(() => {
    actorRef.stop?.();
  });

  return actorRef;
}
