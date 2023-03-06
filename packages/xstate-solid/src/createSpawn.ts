import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';
import { ActorRef, ActorBehavior, EventObject, interpret } from 'xstate';

export function createSpawn<TState, TEvent extends EventObject>(
  behavior: ActorBehavior<TEvent, TState>
): ActorRef<TEvent, TState> {
  const actorRef = interpret(behavior);

  if (!isServer) {
    actorRef.start?.();
    onCleanup(() => actorRef!.system.stop?.());
  }

  return actorRef;
}
