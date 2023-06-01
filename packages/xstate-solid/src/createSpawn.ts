import { onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';
import { ActorRef, ActorLogic, EventObject, interpret } from 'xstate';

export function createSpawn<TState, TEvent extends EventObject>(
  logic: ActorLogic<TEvent, TState>
): ActorRef<TEvent, TState> {
  const actorRef = interpret(logic);

  if (!isServer) {
    actorRef.start?.();
    onCleanup(() => actorRef!.stop?.());
  }

  return actorRef;
}
