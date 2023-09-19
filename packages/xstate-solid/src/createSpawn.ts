import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';
import { ActorRef, ActorLogic, EventObject, createActor } from 'xstate';

export function createSpawn<TState, TEvent extends EventObject>(
  logic: ActorLogic<TState, TEvent>
): ActorRef<TEvent, TState> {
  const actorRef = createActor(logic);

  if (!isServer) {
    actorRef.start?.();
    onCleanup(() => actorRef!.stop?.());
  }

  return actorRef;
}
